import redis from 'redis';
import bluebird from 'bluebird';
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
import _ from 'lodash';
import moment from 'moment';

import {Encode, Decode} from './Protocol';

/**
 * Add to Indexable Priority Queue
 * Example:
 * 
 * EVAL PQADD 1 ns 999 msgid bufferstring
 * 
 * Parameters
 * 
 * Keys 1. Namespace
 * Args 1. Sorted Set Score
 * Args 2. Identifier
 * Args 3. Value
 */
const PQADD = "redis.call('ZADD', KEYS[1]..':pq', ARGV[1], ARGV[2])\n" +
    "redis.call('HSET', KEYS[1]..':index', ARGV[2], ARGV[3])";

/**
 * Popup N item from Indexable Priority Queue
 * Example:
 * 
 * EVAL PQPOP 1 ns 10 1483598266
 * 
 * Parameters
 * 
 * Keys 1. Namespace
 * Args 1. Limit
 * Args 2. Now
 */
const PQPOP = "local t = {}\n" +
    "local len = 0\n" +
    "local key = nil\n" +
    "for i, k in pairs(redis.call('ZRANGE', KEYS[1]..':pq', 0, ARGV[1], 'WITHSCORES')) do\n" +
        "if i % 2 == 1 then\n" +
            "key = k\n" +
        "else\n" +
            "if tonumber(ARGV[2]) < tonumber(k) then break end\n" +
            "len = len + 1\n" +
            "local v = redis.call('HGET', KEYS[1]..':index', key)\n" +
            "table.insert(t, #t + 1, v)\n" +
        "end\n" +
    "end\n" +
    "if len > 0 then\n" +
        "redis.call('ZREMRANGEBYRANK', KEYS[1]..':pq', 0, len)\n" +
    "end\n" +
    "return t";

/**
 * Remove from Indexable Priority Queue
 * Example:
 * 
 * EVAL PQREM 1 ns msgid
 * 
 * Parameters
 * 
 * Keys 1. Namespace
 * Args 1. Identifier
 */
const PQREM = "redis.call('ZREM', KEYS[1]..':pq', ARGV[1])\n" +
    "redis.call('HDEL', KEYS[1]..':index', ARGV[1])";

/**
 * Popup from Hash
 * Example:
 * 
 * EVAL HPOP 2 key
 * 
 * Parameters
 * 
 * Keys 1. Hash Key
 * Keys 2. Field Key
 */
const HPOP = "local v = redis.call('HGET', KEYS[1], KEYS[2])\n" +
    "redis.call('HDEL', KEYS[1], KEYS[2])\n" +
    "return v";

export default class Database{
    constructor(options){
        if(options == undefined){
            options = {};
        }
        this.namespace = options['redis_namespace'] || "httppack";

        // Buffer mode
        _.assign(options, {
            return_buffers: true
        });

        this.client = redis.createClient(options);
    }

    _encodePacket(packet){
        let bufferLength = packet.buffer.length;
        let rawBuffer = Buffer.allocUnsafe(5 + bufferLength);
        rawBuffer.writeUInt8(packet.retryTimes, 0);
        rawBuffer.writeUInt32BE(packet.timestamp, 1);
        packet.buffer.copy(rawBuffer, 5, 0, bufferLength);
        return rawBuffer;
    }

    _decodePacket(rawBuffer){
        let retryTimes = rawBuffer.readInt8(0);
        let timestamp = rawBuffer.readUInt32BE(1);
        let bufferLength = rawBuffer.length - 5;
        let buffer = Buffer.allocUnsafe(bufferLength);
        rawBuffer.copy(buffer, 0, 5, 5 + bufferLength);
        let packet = Decode(buffer);
        packet.retryTimes = retryTimes;
        packet.timestamp = timestamp;
        return packet;
    }

    generateId(scope){
        return this.client.incrAsync(`${this.namespace}:${scope}:uniqueid`).then(function(i){
            return i + (1 << 15);
        });
    }

    evalScore(packet){
        return packet.timestamp;
    }

    savePacket(scope, packet){
        return this.client.evalAsync(PQADD, 1, `${this.namespace}:${scope}`, 
            this.evalScore(packet), packet.identifier, this._encodePacket(packet));
    }

    unconfirmedPacket(scope, limit){
        let now = moment().unix();
        return this.client.evalAsync(PQPOP, 1, `${this.namespace}:${scope}`, limit, now).then(function(buffers){
            return _.map(buffers, function(buffer){
                return this._decodePacket(buffer);
            }.bind(this));
        }.bind(this));
    }

    confirmPacket(scope, identifier){
        return this.client.evalAsync(PQREM, 1, `${this.namespace}:${scope}`, identifier);
    }

    receivePacket(scope, identifier, payload){
        return this.client.hsetAsync(`${this.namespace}:${scope}:payloads`, identifier, payload);
    }

    releasePacket(scope, identifier){
        return this.client.evalAsync(HPOP, 2, `${this.namespace}:${scope}:payloads`, identifier);
    }
}