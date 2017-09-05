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

export const MSG_TYPE_SEND = 0x1;
export const MSG_TYPE_ACK = 0x2;
export const MSG_TYPE_RECEIVED = 0x3;
export const MSG_TYPE_RELEASE = 0x4;
export const MSG_TYPE_COMPLETED = 0x5;

export const QoS0 = 0;
export const QoS1 = 1;
export const QoS2 = 2;

export function Encode(msgType = MSG_TYPE_SEND, qos = QoS0, dup = 0, identifier = 0, payload){
    let remainingLength = 0;
    if(payload != undefined){
        remainingLength = payload.length;
    }
    let buffer = Buffer.allocUnsafe(5 + remainingLength);
    let fixedHeader = (msgType << 4) | (qos << 2) | (dup << 1);
    buffer.writeUInt8(fixedHeader, 0);
    buffer.writeUInt16BE(identifier, 1);
    buffer.writeUInt16BE(remainingLength, 3);
    if(payload != undefined){
        payload.copy(buffer, 5, 0, remainingLength);
    }
    let packet = new Packet(msgType, qos, dup, identifier, payload);
    packet.buffer = buffer;
    return packet;
}

export function Decode(buffer, offset = 0){
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

export class Packet{
    constructor(msgType = MSG_TYPE_SEND, qos = QoS0, dup = 0, identifier = 0, payload){
        this.msgType = msgType;
        this.qos = qos;
        this.dup = dup;
        this.identifier = identifier;
        this.payload = payload;
        if(payload == undefined){
            this.remainingLength = 0;
        } else {
            this.remainingLength = payload.length;
        }
        this.totalLength = 5 + this.remainingLength;
        this.confirm = false;
        this.retryTimes = 0;
        this.timestamp = 0;
        this.buffer = null;
    }
}