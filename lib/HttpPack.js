'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _Database = require('./Database');

var _Database2 = _interopRequireDefault(_Database);

var _Protocol = require('./Protocol');

var Protocol = _interopRequireWildcard(_Protocol);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class HttpPack {
    constructor(options) {
        this.db = new _Database2.default(options);
    }

    handlePacket(scope, packet, callback) {
        if (packet.msgType == Protocol.MSG_TYPE_SEND) {
            if (packet.qos == Protocol.QoS0) {
                callback(scope, packet.payload);
                return null;
            } else if (packet.qos == Protocol.QoS1) {
                let replyPacket = Protocol.Encode(Protocol.MSG_TYPE_ACK, Protocol.QoS0, 0, packet.identifier);
                return this.db.savePacket(scope, replyPacket).then(function () {
                    callback(scope, packet.payload);
                }.bind(this));
            } else if (packet.qos == Protocol.QoS2) {
                return this.db.receivePacket(scope, packet.identifier, packet.payload).then(function () {
                    let replyPacket = Protocol.Encode(Protocol.MSG_TYPE_RECEIVED, Protocol.QoS0, 0, packet.identifier);
                    return this.db.savePacket(scope, replyPacket);
                }.bind(this));
            }
        } else if (packet.msgType == Protocol.MSG_TYPE_ACK) {
            return this.db.confirmPacket(scope, packet.identifier);
        } else if (packet.msgType == Protocol.MSG_TYPE_RECEIVED) {
            return this.db.confirmPacket(scope, packet.identifier).then(function () {
                let replyPacket = Protocol.Encode(Protocol.MSG_TYPE_RELEASE, Protocol.QoS1, 0, packet.identifier);
                return this.db.savePacket(scope, replyPacket);
            }.bind(this));
        } else if (packet.msgType == Protocol.MSG_TYPE_RELEASE) {
            return this.db.releasePacket(scope, packet.identifier).then(function (payload) {
                if (payload != undefined) {
                    callback(scope, payload);
                }
                let replyPacket = Protocol.Encode(Protocol.MSG_TYPE_COMPLETED, Protocol.QoS0, 0, packet.identifier);
                return this.db.savePacket(scope, replyPacket);
            }.bind(this));
        } else if (packet.msgType == Protocol.MSG_TYPE_COMPLETED) {
            return this.db.confirmPacket(scope, packet.identifier);
        }
    }

    generateRetryPacket(packet) {
        if (packet.qos == Protocol.QoS0) {
            return null;
        } else {
            if (packet.retryTimes != undefined && packet.retryTimes > 0) {
                let retryPacket = _lodash2.default.cloneDeep(packet);
                retryPacket.retryTimes++;
                retryPacket.timestamp = (0, _moment2.default)().add(retryPacket.retryTimes * 5, 's').unix();
                return retryPacket;
            } else {
                let retryPacket = Protocol.Encode(packet.msgType, packet.qos, 1, packet.identifier, packet.payload);
                retryPacket.retryTimes = 1;
                retryPacket.timestamp = (0, _moment2.default)().add(retryPacket.retryTimes * 5, 's').unix();
                return retryPacket;
            }
        }
    }

    splitBuffer(buffer) {
        let packets = [];
        let length = buffer.length;
        let offset = 0;
        while (offset < buffer.length) {
            let packet = Protocol.Decode(buffer, offset);
            packets.push(packet);
            offset += packet.totalLength;
        }
        return packets;
    }

    combinePacket(packets) {
        let buffers = _lodash2.default.map(packets, function (packet) {
            return packet.buffer;
        }.bind(this));
        return Buffer.concat(buffers);
    }

    // Public method

    parseBody(scope, body, callback) {
        if (body == undefined) {
            let nullString = new Buffer('', 'utf-8');
            return Promise.resolve(nullString);
        }
        body = new Buffer(body, 'utf-8');
        let packets = this.splitBuffer(body);
        let waitHandles = _lodash2.default.map(packets, function (packet) {
            return this.handlePacket(scope, packet, callback);
        }.bind(this));
        return Promise.all(waitHandles);
    }

    generateBody(scope) {
        let respondPackets = this.db.unconfirmedPacket(scope, 5);
        return respondPackets.then(function (packets) {
            let waitHandles = _lodash2.default.map(packets, function (packet) {
                let retryPacket = this.generateRetryPacket(packet);
                if (retryPacket != undefined) {
                    return this.db.savePacket(scope, retryPacket).then(function () {
                        return packet;
                    });
                }
                return packet;
            }.bind(this));
            return Promise.all(waitHandles).then(function (packets) {
                return this.combinePacket(packets);
            }.bind(this));
        }.bind(this));
    }

    commit(scope, payload, qos = Protocol.QoS0) {
        if (typeof payload == 'string') {
            payload = new Buffer(payload, 'utf-8');
        }
        return this.db.generateId(scope).then(function (id) {
            let packet = Protocol.Encode(Protocol.MSG_TYPE_SEND, qos, 0, id, payload);
            return this.db.savePacket(scope, packet);
        }.bind(this));
    }
}
exports.default = HttpPack;
//# sourceMappingURL=HttpPack.js.map