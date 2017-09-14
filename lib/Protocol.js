"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Encode = Encode;
exports.Decode = Decode;
/**
 * bit           | 7 | 6 | 5 | 4 |  3  |  2  |    1     |    0     |
 * byte1         | Message Type  | QoS Level | Dup flag | Reserved |
 * byte2 - byte3 |              Message Identifiers
 * byte4 - byte5 |              Remaining Length
 * 
 * * * Message Type * *
 * 0 Reserved
 * 1 Send
 * 2 Ack
 * 3 Received
 * 4 Released
 * 5 Completed
 * 
 * * * QoS Level * *
 * 0 1 2
 * 
 * * * Dup flag * *
 * 0 1
 * 
 * * * Message Identifiers * *
 * 0 - 2^32
 */

const MSG_TYPE_SEND = exports.MSG_TYPE_SEND = 0x1;
const MSG_TYPE_ACK = exports.MSG_TYPE_ACK = 0x2;
const MSG_TYPE_RECEIVED = exports.MSG_TYPE_RECEIVED = 0x3;
const MSG_TYPE_RELEASE = exports.MSG_TYPE_RELEASE = 0x4;
const MSG_TYPE_COMPLETED = exports.MSG_TYPE_COMPLETED = 0x5;

const QoS0 = exports.QoS0 = 0;
const QoS1 = exports.QoS1 = 1;
const QoS2 = exports.QoS2 = 2;

function Encode(msgType = MSG_TYPE_SEND, qos = QoS0, dup = 0, identifier = 0, payload) {
    let remainingLength = 0;
    if (payload != undefined) {
        remainingLength = payload.length;
    }
    let buffer = Buffer.allocUnsafe(5 + remainingLength);
    let fixedHeader = msgType << 4 | qos << 2 | dup << 1;
    buffer.writeUInt8(fixedHeader, 0);
    buffer.writeUInt16BE(identifier, 1);
    buffer.writeUInt16BE(remainingLength, 3);
    if (payload != undefined) {
        payload.copy(buffer, 5, 0, remainingLength);
    }
    let packet = new Packet(msgType, qos, dup, identifier, payload);
    packet.buffer = buffer;
    return packet;
}

function Decode(buffer, offset = 0) {
    let fixedHeader = buffer.readInt8(offset);
    let msgType = fixedHeader >> 4;
    let qos = (fixedHeader & 0xf) >> 2;
    let dup = (fixedHeader & 0x3) >> 1;
    let identifier = buffer.readUInt16BE(offset + 1);
    let remainingLength = buffer.readUInt16BE(offset + 3);
    let payload = Buffer.allocUnsafe(remainingLength);
    buffer.copy(payload, 0, offset + 5, offset + 5 + remainingLength);
    let packet = new Packet(msgType, qos, dup, identifier, payload);
    packet.buffer = buffer;
    return packet;
}

class Packet {
    constructor(msgType = MSG_TYPE_SEND, qos = QoS0, dup = 0, identifier = 0, payload) {
        this.msgType = msgType;
        this.qos = qos;
        this.dup = dup;
        this.identifier = identifier;
        this.payload = payload;
        if (payload == undefined) {
            this.remainingLength = 0;
        } else {
            this.remainingLength = payload.length;
        }
        this.totalLength = 5 + this.remainingLength;
        this.retryTimes = 0;
        this.timestamp = 0;
        this.buffer = null;
    }
}
exports.Packet = Packet;
//# sourceMappingURL=Protocol.js.map