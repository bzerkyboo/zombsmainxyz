const fs = require("fs");
const express = require('express');
const path = require('path');
const ByteBuffer = require("bytebuffer");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

app.get('/', (req, res)=>{
    var options = {
        root: path.join(__dirname)
    };
    res.sendFile(`index.html`, options)
})

app.listen(80, ()=>{
    console.log('listening at http://localhost/');
});

const wss = new WebSocket.Server({ port: 8080 }, () => {
    console.log('session saver started');
});

let counts = 0;
const connections = new Map();
const sessions = {};
const sessionsNames = {};
const sessions_1 = {};
const records = {};
const verifyRecords = {};
const leaderboardData = {};
const serversSessions = {};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encode = e => encoder.encode(e);
const decode = e => { try { return decoder.decode(e); } catch {} };

const sendSessions = () => {
    try {
        connections.forEach(e => {
            if (e.type == "user") {
                e && e.send(encode(`sessions,  ;${JSON.stringify(sessionsNames)}`));
            }
        });
    } catch(e) {
        console.log(e);
    }
}

const cipher = salt => {
    const textToChars = text => text.split('').map(c => c.charCodeAt(0));
    const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = code => textToChars(salt).reduce((a,b) => a ^ b, code);
    return text => text.split('').map(textToChars).map(applySaltToChar).map(byteHex).join('');
}

let salt = "@k+^MzEm_Z~I7dvklz{;OIn'6Hrv&);_-v%VJ5guW&dZ]#KX{A";
let adminsalt = ";I%;!Rdr6c3cv!T91v2k5w)eI-G#427jC(gZaCMcmbN4nlhFAf";

wss.on('connection', ws => {
    ws.id = counts++;
    ws.type = null;
    ws.sessionConnectedToId = null;
    ws.isVerified = null;
    let hasAccess = false;
    let isAdmin = false;
    const key = (Math.random() * 99999).toString(16);
    const encodedKey = cipher(salt)(key);
    const encodedKey2 = cipher(adminsalt)(key);
    console.log(`${ws.id} joined.`);
    const sendMessage = m => {
        try {
            ws && ws.readyState == 1 && ws.send(encode(m));
        } catch(e) {
            console.log(e);
        }
    }
    ws.on('message', m => {
        let x = new Uint8Array(m);
        if (ws.sessionConnectedToId) {
            if (hasAccess && x[0] == 1 && ws.isVerified && sessions_1[ws.sessionConnectedToId]) {
                x = x.slice(1);
                const opcode = x[0];
                if (opcode == 9) {
                    const data = sessions_1[ws.sessionConnectedToId].codec.decode(x);
                    if (data.name == "BuyItem" && data.response.tier == 1) {
                        if (data.response.itemName == "PetCARL" || data.response.itemName == "PetMiner") return;
                        if (data.response.itemName == "Pickaxe" && sessions_1[ws.sessionConnectedToId].inventory.Pickaxe) return;
                        if (data.response.itemName == "Spear" && sessions_1[ws.sessionConnectedToId].inventory.Spear) return;
                        if (data.response.itemName == "Bow" && sessions_1[ws.sessionConnectedToId].inventory.Bow) return;
                        if (data.response.itemName == "Bomb" && sessions_1[ws.sessionConnectedToId].inventory.Bomb) return;
                    }
                    if (data.name == "SetPartyName" && !(new TextEncoder().encode(data.response.partyName).length <= 49)) return;
                    if (data.name == "SendChatMessage" && !(new TextEncoder().encode(data.response.message).length <= 249)) return;
                }
                sessions_1[ws.sessionConnectedToId].ws.send(x);
                return;
            }
            if (hasAccess && x[0] == 2 && ws.isVerified) {
                sessions_1[ws.sessionConnectedToId] && sessions_1[ws.sessionConnectedToId].ws && sessions_1[ws.sessionConnectedToId].ws.readyState == 1 && sessions_1[ws.sessionConnectedToId].ws.send(x.slice(1));
                return;
            }
        }
        let msg = decode(m);
        if (!msg) return;
        if (!hasAccess) {
            if (msg.startsWith("plsverify")) {
                sendMessage(`encodeyounoob,  ;${key}`);
            }
            if (msg.startsWith("decodednoob")) {
                let args = msg.split(",  ;");
                if (args[1] == encodedKey || args[1] == encodedKey2) {
                    hasAccess = true;
                    sendMessage("accesssuccess");
                    if (args[1] == encodedKey2) isAdmin = true;
                }
            }
        }
        if (isAdmin) {
            if (msg.startsWith("changehasaccess")) {
                let args = msg.split(",  ;");
                salt = args[1];
            }
        }
        if (msg == "getleaderboarddata") {
            sendMessage(`leaderboarddata,  ;${JSON.stringify(leaderboardData)}`);
        }
        if (!hasAccess) return;
        if (msg.startsWith("user")) {
            sendMessage(`id,  ;${ws.id}`);
            sendMessage(`sessions,  ;${JSON.stringify(sessionsNames)}`);
            ws.type = "user";
        }
        if (msg == "getsessions") {
            sendMessage(`sessions,  ;${JSON.stringify(sessionsNames)}`);
        }
        if (msg == "getrecords") {
            sendMessage(`records,  ;${JSON.stringify(records)}`);
        }
        if (msg == "getverifiedrecords") {
            sendMessage(`verifiedrecords,  ;${JSON.stringify(verifyRecords)}`);
        }
        if (ws.type == "user") {
            if (msg.startsWith("verify")) {
                let sid = parseInt(msg.split(",  ;")[1]);
                if (sessions[sid]) {
                    if(sessions[ws.sessionConnectedToId] && sessions[ws.sessionConnectedToId][ws.id]) delete sessions[ws.sessionConnectedToId][ws.id];
                    ws.sessionConnectedToId = sid;
                    ws.isVerified = false;
                    sessions[sid][ws.id] = ws.id;
                    sendSessions();
                    sessions[sid] && Object.values(sessions[sid]).forEach(e => {
                        let ws = connections.get(e);
                        ws && !ws.isVerified && (ws.send(encode(`verifydata,  ;${JSON.stringify(sessions_1[sid].getSyncNeeds())}`)), ws.isVerified = true);
                    });
                }
            }
            if (msg.startsWith("createsession")) {
                let args = msg.split(",  ;");
                let sessionName;
                args[1] ? (sessionName = args[1].slice(0, 25)) : null;
                let name = args[2] || "";
                let sid = args[3];
                let psk = args[4];
                new Bot(sessionName, name, sid, psk);
            }
            if (msg.startsWith("decodeOpcode5")) {
                let args = msg.split(",  ;");
                let opcode5data = JSON.parse(args[1]);
                let hostname = args[2];
                decodeOpcode5(opcode5data, hostname).then(e => {
                    e[5].extra = Array.from(new Uint8Array(e[5].extra));
                    e[6] = Array.from(new Uint8Array(e[6]));
                    ws && ws.send(encode("decodedOpcode5,  ;" + JSON.stringify(e)));
                });
            }
            if (msg.startsWith("ear")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autorespawn = true);
            }
            if (msg.startsWith("dar")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autorespawn = false);
            }
            if (msg.startsWith("eah")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoheal = true);
            }
            if (msg.startsWith("dah")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoheal = false);
            }
            if (msg.startsWith("eab")) {
                if (!sessions_1[ws.sessionConnectedToId] || !sessions_1[ws.sessionConnectedToId].gs) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                _this.scripts.autobuild = true;
                _this.inactiveRebuilder.forEach((e, t) => _this.inactiveRebuilder.delete(t));
                _this.rebuilder.forEach((e, t) => _this.rebuilder.delete(t));
                Object.values(_this.buildings).forEach(e => {
                    _this.rebuilder.set((e.x - _this.gs.x) / 24 + (e.y - _this.gs.y) / 24 * 1000, [(e.x - _this.gs.x) / 24, (e.y - _this.gs.y) / 24, e.type]);
                })
            }
            if (msg.startsWith("dab")) {
                if (!sessions_1[ws.sessionConnectedToId]) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                _this.scripts.autobuild = false;
                _this.inactiveRebuilder.forEach((e, t) => _this.inactiveRebuilder.delete(t));
                _this.rebuilder.forEach((e, t) => _this.rebuilder.delete(t));
            }
            if (msg.startsWith("eau")) {
                if (!sessions_1[ws.sessionConnectedToId] || !sessions_1[ws.sessionConnectedToId].gs) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                _this.scripts.autoupgrade  = true;
                _this.inactiveReupgrader.forEach((e, t) => _this.inactiveReupgrader.delete(t));
                _this.reupgrader.forEach((e, t) => _this.reupgrader.delete(t));
                Object.values(_this.buildings).forEach(e => {
                    _this.reupgrader.set((e.x - _this.gs.x) / 24 + (e.y - _this.gs.y) / 24 * 1000, [(e.x - _this.gs.x) / 24, (e.y - _this.gs.y) / 24, e.tier]);
                })
            }
            if (msg.startsWith("dau")) {
                if (!sessions_1[ws.sessionConnectedToId]) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                _this.scripts.autoupgrade = false;
                _this.inactiveReupgrader.forEach((e, t) => _this.inactiveReupgrader.delete(t));
                _this.reupgrader.forEach((e, t) => _this.reupgrader.delete(t));
            }
            if (msg == "eaa") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaim = true);
            }
            if (msg == "daa") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaim = false);
            }
            if (msg.startsWith("eatb")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobow = true);
            }
            if (msg.startsWith("datb")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobow = false);
            }
            if (msg.startsWith("eapr")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetrevive = true);
            }
            if (msg.startsWith("dapr")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetrevive = false);
            }
            if (msg.startsWith("eaph")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetheal = true);
            }
            if (msg.startsWith("daph")) {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetheal = false);
            }
            if (msg == "eat") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autotimeout = true);
            }
            if (msg == "dat") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autotimeout = false);
            }
            if (msg == "ept") {
                if (!sessions_1[ws.sessionConnectedToId]) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                const args = msg.split(",  ;");
                _this.scripts.playertrick = true;
                _this.playerTrickPsk = (!args[1] || args[1].length != 20) ? _this.partyShareKey : args[1];
            }
            if (msg == "dpt") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.playertrick = false);
            }
            if (msg == "erpt") {
                if (!sessions_1[ws.sessionConnectedToId]) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                const args = msg.split(",  ;");
                _this.scripts.reverseplayertrick = true;
                _this.playerTrickPsk = (!args[1] || args[1].length != 20) ? _this.partyShareKey : args[1];
            }
            if (msg == "drpt") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.reverseplayertrick = false);
            }
            if (msg == "eaaz") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaimonzombies = true);
            }
            if (msg == "daaz") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaimonzombies = false);
            }
            if (msg == "eahrc") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.ahrc = true);
            }
            if (msg == "dahrc") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.ahrc = false);
            }
            if (msg == "earf") {
                sessions_1[ws.sessionConnectedToId] && (serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).filler = true);
            }
            if (msg == "darf") {
                sessions_1[ws.sessionConnectedToId] && (serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).filler = false);
            }
            if (msg == "epl") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.positionlock = true);
            }
            if (msg == "dpl") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.positionlock = false);
            }
            if (msg == "eape") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetevolve = true);
            }
            if (msg == "dape") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetevolve = false);
            }
            if (msg == "earc") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoreconnect = true);
            }
            if (msg == "darc") {
                sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoreconnect = false);
            }
            if (msg.startsWith("lock")) {
                if (!sessions_1[ws.sessionConnectedToId]) return;
                const _this = sessions_1[ws.sessionConnectedToId];
                const args = msg.split(",  ;");
                if (args[1]) {
                    let pos = args[1].split(" ");
                    let x = parseInt(pos[0]);
                    let y = parseInt(pos[1]);
                    _this.lockPos = {x: x || _this.myPlayer.position.x, y: y || _this.myPlayer.position.y};
                } else {
                    _this.lockPos = {x: _this.myPlayer.position.x, y: _this.myPlayer.position.y};
                }
            }
            if (msg.startsWith("closesession")) {
                let args = msg.split(",  ;");
                if (sessions_1[args[1]]) {
                    sessions_1[args[1]].scripts.autoreconnect = false;
                    sessions_1[args[1]].disconnect();
                }
            }
            if (msg.startsWith("changesessionname")) {
                let args = msg.split(",  ;");
                sessionsNames[args[1]] && (sessionsNames[args[1]].sessionName = (args[2] && args[2].slice(0, 25)) || "Session");
                sendSessions();
            }
            if (msg.startsWith("changesessionid")) {
                let args = msg.split(",  ;");
                sessionsNames[args[1]] && (sessionsNames[args[1]].sessionUserId = parseInt(args[2]));
                sendSessions();
            }
        }
    })
    ws.on("error", () => console.log("error"));
    ws.on("close", () => {
        try {
            console.log(`${ws.id} disconnected.`);
            connections.delete(ws.id);
            if (sessions[ws.sessionConnectedToId] && sessions[ws.sessionConnectedToId][ws.id]) {
                delete sessions[ws.sessionConnectedToId][ws.id];
            }
            sendSessions();
        } catch(e) {
            console.log(e);
        }
    });
    connections.set(ws.id, ws);
});
wss.on("error", () => console.log("error"));
wss.on('listening', () => console.log('listening on 8080'));

class Scripts {
    constructor() {
        this.autoheal = true;
        this.healset = 15;
        this.pethealset = 30;
        this.autorespawn = false;
        this.autobuild = false;
        this.autoupgrade = false;
        this.autoaim = false;
        this.autobow = false;
        this.autopetrevive = false;
        this.autopetheal = false;
        this.playertrick = false;
        this.reverseplayertrick = false;
        this.autoaimonzombies = false;
        this.ahrc = false;
        this.positionlock = false;
        this.autopetevolve = false;
        this.autoreconnect = true;
        this.autotimeout = true;
    }
}

class Bot {
    constructor(sessionName = null, name = " ", sid = "", psk = "") {
        if (!sid || !serverMap.get(sid)) return;
        if (serversSessions[sid]) {
            let count = 0;
            serversSessions[sid].forEach(ws => {
                if (ws.readyState == 0 || ws.readyState == 1) {
                    count++;
                }
                if (ws.readyState == 2 || ws.readyState == 3) {
                    ws.close();
                    serversSessions[sid].delete(ws);
                }
            })
            if (count >= 8) return;
        }
        this.sessionName = sessionName;
        this.name = name;
        this.serverId = sid;
        this.host = serverMap.get(sid).host;
        this.hostname = serverMap.get(sid).hostname;
        this.psk = psk;
        this.ws = new WebSocket(`wss://${this.host}:443/`, {headers: {"Origin": "","User-Agent": ""} });
        this.ws.binaryType = "arraybuffer";
        this.codec = new BinCodec();
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = () => {};
        if (!serversSessions[this.serverId]) serversSessions[this.serverId] = new Set();
        serversSessions[this.serverId].add(this.ws);
        this.entities = new Map();
        this.buildings = {};
        this.inventory = {};
        this.partyInfo = [];
        this.partyShareKey = psk;
        this.dayCycle = {cycleStartTick: 100, nightEndTick: 0, dayEndTick: 1300, isDay: 1};
        this.leaderboard = [];
        this.messages = [];
        this.parties = {};
        this.castSpellResponse = {};
        this.buildingUids_1 = {};
        this.uid = 0;
        this.tick = 100;
        this.hasVerified = false;
        this.scripts = new Scripts();
        this.petActivated = false;
        this.gs = null;
        this.rebuilder = new Map();
        this.inactiveRebuilder = new Map();
        this.reupgrader = new Map();
        this.inactiveReupgrader = new Map();
        this.nearestPlayer = null;
        this.nearestZombie = null;
        this.nearestPlayerDistance = Infinity;
        this.nearestZombieDistance = Infinity;
        this.playerTrickPsk = null;
        this.leaveOnce = null;
        this.joinOnce = null;
        this.harvesters = new Map();
        this.harvesterTicks = [
            {tick: 0, resetTick: 31, deposit: 0.4, tier: 1},
            {tick: 0, resetTick: 29, deposit: 0.6, tier: 2},
            {tick: 0, resetTick: 27, deposit: 0.7, tier: 3},
            {tick: 0, resetTick: 24, deposit: 1, tier: 4},
            {tick: 0, resetTick: 22, deposit: 1.2, tier: 5},
            {tick: 0, resetTick: 20, deposit: 1.4, tier: 6},
            {tick: 0, resetTick: 18, deposit: 2.4, tier: 7},
            {tick: 0, resetTick: 16, deposit: 3, tier: 8}
        ];
        this.players = false;
        this.positionRest = null;
        this.lockPos = {x: 12000, y: 12000};
        leaderboardData[this.serverId] = [];
    }
    encode(e) {
        return new Uint8Array(codec.encode(9, {name: "message", msg: e}));
    }
    decode(e) {
        return codec.decode(new Uint8Array(e)).response.msg;
    }
    sendMessage(m) {
        this.wss && this.wss.send(this.encode(m));
    }
    sendPacket(event, data) {
        this.ws && this.ws.readyState == 1 && this.ws.send(new Uint8Array(this.codec.encode(event, data)));
    }
    sendData(data) {
        sessions[this.userId] && Object.values(sessions[this.userId]).forEach(e => {
            let ws = connections.get(e);
            ws && ws.isVerified && ws.readyState == 1 && ws.send(data);
        });
    }
    async onMessage(msg) {
        const opcode = new Uint8Array(msg.data)[0];
        const m = new Uint8Array(msg.data);
        if (opcode == 5) {
            this.Module = wasmmodule();
            console.log(m, this.hostname)
            this.Module.onDecodeOpcode5(m, this.hostname, decodedopcode5 => {
                this.sendPacket(4, {displayName: this.name, extra: decodedopcode5[5]});
                this.enterworld2 = decodedopcode5[6];
            });
            return;
        }
        if (opcode == 10) {
            this.ws.send(this.Module.finalizeOpcode10(m));
            return;
        }
        const data = this.codec.decode(msg.data);
        switch(opcode) {
            case 0:
                this.onEntitiesUpdateHandler(data);
                this.sendData(msg.data);
                !this.hasVerified && (this.userId = counts++, sessions[this.userId] = {}, sessionsNames[this.userId] = {sessionName: this.sessionName || "Session", sessionUserId: this.userId, actualUserId: this.userId}, sessions_1[this.userId] = this, sendSessions(), this.hasVerified = true);
                break;
            case 4:
                this.onEnterWorldHandler(data);
                break;
            case 9:
                this.onRpcUpdateHandler(data);
                let x = new Uint8Array(msg.data);
                this.sendData(x);
                break;
        }
    }
    onEntitiesUpdateHandler(data) {
        this.tick = data.tick;
        data.entities.forEach((entity, uid) => {
            const entity_1 = this.entities.get(uid);
            !entity_1 ? this.entities.set(uid, {uid: uid, targetTick: entity, model: entity.model}) : Object.keys(entity).forEach(e => entity_1.targetTick[e] = entity[e]);
        })
        this.nearestPlayer = null;
        this.nearestZombie = null;
        this.nearestPlayerDistance = Infinity;
        this.nearestZombieDistance = Infinity;
        this.entities.forEach((entity, uid) => {
            if (!data.entities.has(uid)) {
                this.entities.delete(uid);
                return;
            }
            if (this.scripts.autoaim) {
                if (entity.targetTick.model == "GamePlayer" && entity.targetTick.uid !== this.myPlayer.uid && entity.targetTick.partyId !== this.myPlayer.partyId && !entity.targetTick.dead) {
                    const distance = Math.hypot(entity.targetTick.position.x - this.myPlayer.position.x, entity.targetTick.position.y - this.myPlayer.position.y);
                    if (this.nearestPlayerDistance > distance) {
                        this.nearestPlayerDistance = distance;
                        this.nearestPlayer = entity.targetTick;
                    }
                }
            }
            if (this.scripts.autoaimonzombies) {
                if (entity.targetTick.model.startsWith("Zombie")) {
                    const distance = Math.hypot(entity.targetTick.position.x - this.myPlayer.position.x, entity.targetTick.position.y - this.myPlayer.position.y);
                    if (this.nearestZombieDistance > distance) {
                        this.nearestZombieDistance = distance;
                        this.nearestZombie = entity.targetTick;
                    }
                }
            }
        });
        this.myPlayer = this.entities.get(this.uid) && this.entities.get(this.uid).targetTick;
        this.myPet = this.myPlayer && this.entities.get(this.myPlayer.petUid) && this.entities.get(this.myPlayer.petUid).targetTick;
        const userCount = !!Object.keys(sessions[this.userId] || {}).length;
        if (!userCount && this.myPlayer) {
            this.scripts.autorespawn && this.myPlayer.dead && this.sendPacket(3, {respawn: 1});
            this.scripts.autoheal && (this.myPlayer.health / 5) <= this.scripts.healset && this.myPlayer.health > 0 && this.heal();
        }
        if ((!userCount || this.scripts.autopetheal) && this.myPet) {
            this.scripts.autoheal && (this.myPet.health / this.myPet.maxHealth)*100 <= this.scripts.pethealset && this.myPet.health > 0 && (this.buy("PetHealthPotion", 1), this.equip("PetHealthPotion", 1));
        }
        this.myPet && !this.petActivated && (this.petActivated = true);
        !userCount && !this.inventory.HealthPotion && this.buy("HealthPotion", 1);
        this.gs && this.scripts.autobuild && this.inactiveRebuilder.forEach(e => {
            const x = e[0] * 24 + this.gs.x;
            const y = e[1] * 24 + this.gs.y;
            if (Math.abs(this.myPlayer.position.x - x) < 576 && Math.abs(this.myPlayer.position.y - y) < 576) {
                this.sendPacket(9, {name: "MakeBuilding", x: x, y: y, type: e[2], yaw: 0});
            }
        })
        this.gs && this.scripts.autoupgrade && this.inactiveReupgrader.forEach(e => {
            const x = e[0] * 24 + this.gs.x;
            const y = e[1] * 24 + this.gs.y;
            if (Math.hypot((this.myPlayer.position.x - x), (this.myPlayer.position.y - y)) <= 768) {
                if (e[5] - this.tick <= 0) {
                    e[5] = this.tick + 7;
                    this.sendPacket(9, {name: "UpgradeBuilding", uid: e[4]});
                }
            }
        })
        this.scripts.autoaim && this.nearestPlayer && this.sendPacket(3, {mouseMoved: ((Math.atan2(this.nearestPlayer.position.y - this.myPlayer.position.y, this.nearestPlayer.position.x - this.myPlayer.position.x) * 180/Math.PI + 450) % 360) | 0});
        this.scripts.autoaimonzombies && this.nearestZombie && this.sendPacket(3, {mouseMoved: ((Math.atan2(this.nearestZombie.position.y - this.myPlayer.position.y, this.nearestZombie.position.x - this.myPlayer.position.x) * 180/Math.PI + 450) % 360) | 0});
        this.scripts.autobow && (this.sendPacket(3, {space: 0}), this.sendPacket(3, {space: 1}));
        this.scripts.autopetrevive && this.petActivated && (this.sendPacket(9, {name: "BuyItem", itemName: "PetRevive", tier: 1}), this.sendPacket(9, {name: "EquipItem", itemName: "PetRevive", tier: 1}));

        if (this.scripts.playertrick || this.scripts.reverseplayertrick) {
            const daySeconds = Math.floor((this.tick * 50 / 1000 + 60) % 120);
            if (!this.leaveOnce && daySeconds > 18) {
                this.leaveOnce = true;
                this.scripts.reverseplayertrick ? this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.playerTrickPsk}) : this.sendPacket(9, {name: "LeaveParty"});
            }
            if (!this.joinOnce && daySeconds >= 118 && this.playerTrickPsk) {
                this.joinOnce = true;
                this.scripts.reverseplayertrick ? this.sendPacket(9, {name: "LeaveParty"}) : this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.playerTrickPsk});
            }
        }
        this.scripts.ahrc && this.harvesterTicks.forEach(e => {
            e.tick++;
            if (e.tick >= e.resetTick) {
                e.tick = 0;
                this.depositAhrc(e);
            }
            if (e.tick == 1) {
                this.collectAhrc(e);
            }
        });
        const server = serverMap.get(this.serverId);
        if (server.filler && this.tick > server.tick && (this.players !== 32 || this.dayCycle.isDay)) {
            let count = 0;
            serversSessions[this.serverId].forEach(ws => {
                if (ws.readyState == 0 || ws.readyState == 1) {
                    count++;
                }
            })
            if (count < 8) {
                let amt = Math.min(8 - count, 4);
                let amtNeededToFill = this.dayCycle.isDay ? 1 : ((32 - this.players) || 1);
                let finalAmt = Math.min(amtNeededToFill, amt);
                server.tick = this.tick + 115;
                for (let i = 0; i < finalAmt; i++) {
                    new Bot(this.sessionName, this.name, this.serverId, "");
                }
            }
        }
        if (this.scripts.positionlock) {
            let x = (Math.round(((Math.atan2(this.lockPos.y - this.myPlayer.position.y, this.lockPos.x - this.myPlayer.position.x) * 180/Math.PI + 450) % 360) / 45) * 45) % 360;
            if (Math.hypot(this.lockPos.y - this.myPlayer.position.y, this.lockPos.x - this.myPlayer.position.x) > 100) {
                this.sendPacket(3, {up: (x == 0 || x == 45 || x == 315) ? 1 : 0, down: (x == 135 || x == 180 || x == 225) ? 1 : 0, right: (x == 45 || x == 90 || x == 135) ? 1 : 0, left: (x == 225 || x == 270 || x == 315) ? 1 : 0});
                this.positionRest = x;
            } else {
                if (this.positionRest != 696969) {
                    this.positionRest = 696969;
                    this.sendPacket(3, {up: 0, down: 0, right: 0, left: 0});
                }
            }
        }
    }
    onEnterWorldHandler(data) {
        if (!data.allowed) return;
        this.uid = data.uid;
        this.enterworld2 && this.ws.send(this.enterworld2);
        this.join(this.psk);
        this.buy("HatHorns", 1);
        this.buy("PetCARL", 1);
        this.buy("PetMiner", 1);
        this.equip("PetCARL", 1);
        this.equip("PetMiner", 1);
        for (let i = 0; i < 26; i++) this.ws.send(new Uint8Array([3, 17, 123, 34, 117, 112, 34, 58, 49, 44, 34, 100, 111, 119, 110, 34, 58, 48, 125]));
        this.ws.send(new Uint8Array([7, 0]));
        this.ws.send(new Uint8Array([9,6,0,0,0,126,8,0,0,108,27,0,0,146,23,0,0,82,23,0,0,8,91,11,0,8,91,11,0,0,0,0,0,32,78,0,0,76,79,0,0,172,38,0,0,120,155,0,0,166,39,0,0,140,35,0,0,36,44,0,0,213,37,0,0,100,0,0,0,120,55,0,0,0,0,0,0,0,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,134,6,0,0]));
        console.log("bot in game");
    }
    onRpcUpdateHandler(data) {
        switch(data.name) {
            case "LocalBuilding":
                data.response.forEach(e => {
                    if (this.buildingUids_1[e.uid]) return;
                    if (e.dead && !this.buildingUids_1[e.uid]) {
                        this.buildingUids_1[e.uid] = true;
                        setTimeout(() => {
                            delete this.buildingUids_1[e.uid];
                        }, 500);
                    }
                    if (e.type == "GoldStash") {
                        this.gs = e;
                    }
                    if (e.type == "GoldStash" && e.dead) {
                        if (this.scripts.autobuild) {
                            this.rebuilder.forEach(e => {
                                if (e[2] == "GoldStash") return;
                                this.inactiveRebuilder.set(e[0] + e[1] * 1000, e);
                            })
                        }
                        this.gs = null;
                    }
                    this.buildings[e.uid] = e;
                    e.dead && (delete this.buildings[e.uid]);
                    e.type == "Harvester" && this.harvesters.set(e.uid, e);
                    e.type == "Harvester" && e.dead && this.harvesters.delete(e.uid);
                    if (this.scripts.autobuild && this.gs && this.rebuilder.get((e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000)) {
                        const index = (e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000;
                        const _rebuilder = this.rebuilder.get(index);
                        e.dead ? this.inactiveRebuilder.set(index, _rebuilder) : this.inactiveRebuilder.delete(index);
                    }
                    if (this.scripts.autoupgrade && this.gs && this.reupgrader.get((e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000)) {
                        const index = (e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000;
                        const _reupgrader = this.reupgrader.get(index);
                        if (e.dead) {
                            this.inactiveReupgrader.delete(index);
                        } else {
                            if (e.tier < _reupgrader[2]) {
                                !this.inactiveReupgrader.get(index) && this.inactiveReupgrader.set(index, [_reupgrader[0], _reupgrader[1], _reupgrader[2], e.tier, e.uid, this.tick]);
                            } else {
                                this.inactiveReupgrader.delete(index);
                            }
                        }
                    }
                })
                break;
            case "PartyShareKey":
                this.partyShareKey = data.response.partyShareKey;
                this.psk = data.response.partyShareKey;
                break;
            case "Dead":
                this.buy("HatHorns", 1);
                break;
            case "SetItem":
                this.inventory[data.response.itemName] = data.response;
                if (this.inventory.HatHorns && !this.inventory.HatHorns.stacks) this.buy("HatHorns", 1);
                if (!this.inventory[data.response.itemName].stacks) delete this.inventory[data.response.itemName];
                if (data.response.itemName == "ZombieShield" && data.response.stacks) this.equip("ZombieShield", data.response.tier);
                break;
            case "PartyInfo":
                this.partyInfo = data.response;
                break;
            case "SetPartyList":
                this.parties = {};
                this.players = 0;
                data.response.forEach(e => {
                    this.parties[e.partyId] = e;
                    this.players += e.memberCount;
                });
                leaderboardData[this.serverId][0] = this.players;
                break;
            case "DayCycle":
                this.dayCycle = data.response;
                if (!data.response.isDay) {
                    this.leaveOnce = false;
                    this.joinOnce = false;
                    if (this.scripts.autopetevolve && this.myPet && [9, 17, 25, 33, 49, 65, 97].includes(Math.min(Math.floor(this.myPet.experience / 100) + 1, [9, 17, 25, 33, 49, 65, 97][this.myPet.tier - 1]))) {
                        this.sendPacket(9, {name: "BuyItem", itemName: this.myPet.model, tier: this.myPet.tier + 1});
                    }
                }
                break;
            case "Leaderboard":
                this.leaderboard = data.response;
                leaderboardData[this.serverId][1] = data.response;
                break;
            case "ReceiveChatMessage":
                this.messages.push(data.response);
                let _messages = [];
                if (this.messages.length > 50) {
                    for (let i = this.messages.length - 50; i < this.messages.length; i++) {
                        _messages.push(this.messages[i]);
                    }
                    this.messages = _messages;
                }
                break;
            case "CastSpellResponse":
                this.castSpellResponse = data.response;
                break;
        }
    }
    getSyncNeeds() {
        const syncNeeds = [];
        syncNeeds.push({allowed: 1, uid: this.uid, startingTick: this.tick, tickRate: 20, effectiveTickRate: 20, players: 1, maxPlayers: 32, chatChannel: 0, effectiveDisplayName: this.entities.get(this.uid) ? this.entities.get(this.uid).targetTick.name : this.name, x1: 0, y1: 0, x2: 24000, y2: 24000, opcode: 4});
        syncNeeds.push({name: 'PartyInfo', response: this.partyInfo, opcode: 9});
        syncNeeds.push({name: 'PartyShareKey', response: {partyShareKey: this.partyShareKey}, opcode: 9});
        syncNeeds.push({name: 'DayCycle', response: this.dayCycle, opcode: 9});
        syncNeeds.push({name: 'Leaderboard', response: this.leaderboard, opcode: 9});
        syncNeeds.push({name: 'SetPartyList', response: Object.values(this.parties), opcode: 9});
        const localBuildings = Object.values(this.buildings);
        const entities = [];
        this.entities.forEach(e => {
            entities.push([e.uid, e.targetTick]);
        });
        return {tick: this.tick, entities: entities, byteSize: 654, opcode: 0, syncNeeds: syncNeeds, localBuildings: localBuildings, inventory: this.inventory, messages: this.messages, serverId: this.serverId, useRequiredEquipment: true, petActivated: this.petActivated, castSpellResponse: this.castSpellResponse, isPaused: this.myPlayer ? this.myPlayer.isPaused : 0, sortedUidsByType: this.codec.sortedUidsByType, removedEntities: this.codec.removedEntities, absentEntitiesFlags: this.codec.absentEntitiesFlags, updatedEntityFlags: this.codec.updatedEntityFlags};
    }
    disconnect() {
        this.ws.send([]);
    }
    heal() {
        if (this.healTimeout_1) return;
        this.equip("HealthPotion", 1);
        this.buy("HealthPotion", 1);
        this.healTimeout_1 = true;
        setTimeout(() => {this.healTimeout_1 = null}, 500);
    }
    buy(item, tier) {
        this.sendPacket(9, {name: "BuyItem", itemName: item, tier: tier});
    }
    equip(item, tier) {
        this.sendPacket(9, {name: "EquipItem", itemName: item, tier: tier});
    }
    join(psk = "") {
        this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: psk});
    }
    depositAhrc(tick) {
        this.harvesters.forEach(e => {
            if (e.tier == tick.tier) {
                this.sendPacket(9, {name: "AddDepositToHarvester", uid: e.uid, deposit: tick.deposit});
            }
        })
    }
    collectAhrc(tick) {
        this.harvesters.forEach(e => {
            if (e.tier == tick.tier) {
                this.sendPacket(9, {name: "CollectHarvester", uid: e.uid});
            }
        })
    }
    onClose() {
        console.log(this.userId + " closed.");
        this.userId && sessions[this.userId] && (delete sessions[this.userId], delete sessions_1[this.userId], delete sessionsNames[this.userId], sendSessions());
        this.scripts.autoreconnect && this.hasVerified && new Bot(this.sessionName, this.name, this.serverId, this.psk);
    }
}

// server objects

const serverArr = JSON.parse('[["v1001","US East #1","45.76.4.28","zombs-2d4c041c-0.eggs.gg"],["v1002","US East #2","45.77.203.204","zombs-2d4dcbcc-0.eggs.gg"],["v1003","US East #3","45.77.200.150","zombs-2d4dc896-0.eggs.gg"],["v1004","US East #4","104.156.225.133","zombs-689ce185-0.eggs.gg"],["v1005","US East #5","45.77.149.224","zombs-2d4d95e0-0.eggs.gg"],["v1006","US East #6","173.199.123.77","zombs-adc77b4d-0.eggs.gg"],["v1007","US East #7","45.76.166.32","zombs-2d4ca620-0.eggs.gg"],["v1008","US East #8","149.28.58.193","zombs-951c3ac1-0.eggs.gg"],["v2001","US West #1","149.28.87.132","zombs-951c5784-0.eggs.gg"],["v2002","US West #2","45.76.68.210","zombs-2d4c44d2-0.eggs.gg"],["v2003","US West #3","108.61.219.244","zombs-6c3ddbf4-0.eggs.gg"],["v5001","Europe #1","80.240.19.5","zombs-50f01305-0.eggs.gg"],["v5002","Europe #2","45.77.53.65","zombs-2d4d3541-0.eggs.gg"],["v5003","Europe #3","95.179.167.12","zombs-5fb3a70c-0.eggs.gg"],["v5004","Europe #4","95.179.163.97","zombs-5fb3a361-0.eggs.gg"],["v5005","Europe #5","136.244.83.44","zombs-88f4532c-0.eggs.gg"],["v5006","Europe #6","45.32.158.210","zombs-2d209ed2-0.eggs.gg"],["v5007","Europe #7","95.179.169.17","zombs-5fb3a911-0.eggs.gg"],["v3001","Asia #1","45.77.249.75","zombs-2d4df94b-0.eggs.gg"],["v4001","Australia #1","149.28.182.161","zombs-951cb6a1-0.eggs.gg"],["v4002","Australia #2","149.28.165.199","zombs-951ca5c7-0.eggs.gg"]]')
.map(e => ({id: e[0], name: e[1], region: e[1].split(" #")[0], hostname: e[2], players: 0, leaderboard: [], host: e[3], tick: 0}));
const serverMap = new Map(serverArr.map(e => [e.id, e]));
// Bincodec Function

let PacketIds_1 = JSON.parse('{"default":{"0":"PACKET_ENTITY_UPDATE","1":"PACKET_PLAYER_COUNTER_UPDATE","2":"PACKET_SET_WORLD_DIMENSIONS","3":"PACKET_INPUT","4":"PACKET_ENTER_WORLD","5":"PACKET_PRE_ENTER_WORLD","6":"PACKET_ENTER_WORLD2","7":"PACKET_PING","9":"PACKET_RPC","PACKET_PRE_ENTER_WORLD":5,"PACKET_ENTER_WORLD":4,"PACKET_ENTER_WORLD2":6,"PACKET_ENTITY_UPDATE":0,"PACKET_INPUT":3,"PACKET_PING":7,"PACKET_PLAYER_COUNTER_UPDATE":1,"PACKET_RPC":9,"PACKET_SET_WORLD_DIMENSIONS":2}}');
let e_AttributeType = JSON.parse("{\"0\":\"Uninitialized\",\"1\":\"Uint32\",\"2\":\"Int32\",\"3\":\"Float\",\"4\":\"String\",\"5\":\"Vector2\",\"6\":\"EntityType\",\"7\":\"ArrayVector2\",\"8\":\"ArrayUint32\",\"9\":\"Uint16\",\"10\":\"Uint8\",\"11\":\"Int16\",\"12\":\"Int8\",\"13\":\"Uint64\",\"14\":\"Int64\",\"15\":\"Double\",\"Uninitialized\":0,\"Uint32\":1,\"Int32\":2,\"Float\":3,\"String\":4,\"Vector2\":5,\"EntityType\":6,\"ArrayVector2\":7,\"ArrayUint32\":8,\"Uint16\":9,\"Uint8\":10,\"Int16\":11,\"Int8\":12,\"Uint64\":13,\"Int64\":14,\"Double\":15}");
let e_ParameterType = JSON.parse("{\"0\":\"Uint32\",\"1\":\"Int32\",\"2\":\"Float\",\"3\":\"String\",\"4\":\"Uint64\",\"5\":\"Int64\",\"Uint32\":0,\"Int32\":1,\"Float\":2,\"String\":3,\"Uint64\":4,\"Int64\":5}");

class BinCodec {
    constructor() {
        this.attributeMaps = {};
        this.entityTypeNames = {};
        this.rpcMaps = [{"name":"message","parameters":[{"name":"msg","type":3}],"isArray":false,"index":0}, {"name":"serverObj","parameters":[{"name":"data","type":3}],"isArray":false,"index":1}];
        this.rpcMapsByName = {"message": {"name":"message","parameters":[{"name":"msg","type":3}],"isArray":false,"index":0}, "serverObj": {"name":"serverObj","parameters":[{"name":"data","type":3}],"isArray":false,"index":1}};
        this.sortedUidsByType = {};
        this.removedEntities = {};
        this.absentEntitiesFlags = [];
        this.updatedEntityFlags = [];
    }
    encode(name, item) {
        let buffer = new ByteBuffer(100, true);
        switch (name) {
            case PacketIds_1.default.PACKET_ENTER_WORLD:
                buffer.writeUint8(PacketIds_1.default.PACKET_ENTER_WORLD);
                this.encodeEnterWorld(buffer, item);
                break;
            case PacketIds_1.default.PACKET_INPUT:
                buffer.writeUint8(PacketIds_1.default.PACKET_INPUT);
                this.encodeInput(buffer, item);
                break;
            case PacketIds_1.default.PACKET_PING:
                buffer.writeUint8(PacketIds_1.default.PACKET_PING);
                this.encodePing(buffer, item);
                break;
            case PacketIds_1.default.PACKET_RPC:
                buffer.writeUint8(PacketIds_1.default.PACKET_RPC);
                this.encodeRpc(buffer, item);
                break;
        }
        buffer.flip();
        buffer.compact();
        return buffer.toArrayBuffer(false);
    };
    decode(data) {
        let buffer = ByteBuffer.wrap(data);
        buffer.littleEndian = true;
        let opcode = buffer.readUint8();
        let decoded;
        switch (opcode) {
            case PacketIds_1.default.PACKET_ENTER_WORLD:
                decoded = this.decodeEnterWorldResponse(buffer);
                break;
            case PacketIds_1.default.PACKET_ENTITY_UPDATE:
                decoded = this.decodeEntityUpdate(buffer);
                break;
            case PacketIds_1.default.PACKET_PING:
                decoded = this.decodePing(buffer);
                break;
            case PacketIds_1.default.PACKET_RPC:
                decoded = this.decodeRpc(buffer);
                break;
        }
        if (!decoded) return;
        decoded.opcode = opcode;
        return decoded;
    };
    safeReadVString(buffer) {
        let offset = buffer.offset;
        let len = buffer.readVarint32(offset);
        try {
            var func = buffer.readUTF8String.bind(buffer);
            var str = func(len.value, "b", offset += len.length);
            offset += str.length;
            buffer.offset = offset;
            return str.string;
        }
        catch (e) {
            offset += len.value;
            buffer.offset = offset;
            return '?';
        }
    };
    decodeEnterWorldResponse(buffer) {
        let allowed = buffer.readUint32();
        let uid = buffer.readUint32();
        let startingTick = buffer.readUint32();
        let ret = {
            allowed: allowed,
            uid: uid,
            startingTick: startingTick,
            tickRate: buffer.readUint32(),
            effectiveTickRate: buffer.readUint32(),
            players: buffer.readUint32(),
            maxPlayers: buffer.readUint32(),
            chatChannel: buffer.readUint32(),
            effectiveDisplayName: this.safeReadVString(buffer),
            x1: buffer.readInt32(),
            y1: buffer.readInt32(),
            x2: buffer.readInt32(),
            y2: buffer.readInt32()
        };
        let attributeMapCount = buffer.readUint32();
        this.attributeMaps = {};
        this.entityTypeNames = {};
        for (let i = 0; i < attributeMapCount; i++) {
            let attributeMap = [];
            let entityType = buffer.readUint32();
            let entityTypeString = buffer.readVString();
            let attributeCount = buffer.readUint32();
            for (let j = 0; j < attributeCount; j++) {
                let name_1 = buffer.readVString();
                let type = buffer.readUint32();
                attributeMap.push({
                    name: name_1,
                    type: type
                });
            }
            this.attributeMaps[entityType] = attributeMap;
            this.entityTypeNames[entityType] = entityTypeString;
            this.sortedUidsByType[entityType] = [];
        }
        let rpcCount = buffer.readUint32();
        this.rpcMaps = [];
        this.rpcMapsByName = {};
        for (let i = 0; i < rpcCount; i++) {
            let rpcName = buffer.readVString();
            let paramCount = buffer.readUint8();
            let isArray = buffer.readUint8() != 0;
            let parameters = [];
            for (let j = 0; j < paramCount; j++) {
                let paramName = buffer.readVString();
                let paramType = buffer.readUint8();
                parameters.push({
                    name: paramName,
                    type: paramType
                });
            }
            let rpc = {
                name: rpcName,
                parameters: parameters,
                isArray: isArray,
                index: this.rpcMaps.length
            };
            this.rpcMaps.push(rpc);
            this.rpcMapsByName[rpcName] = rpc;
        }
        return ret;
    };
    decodeEntityUpdate(buffer) {
        let tick = buffer.readUint32();
        let removedEntityCount = buffer.readVarint32();
        const entityUpdateData = {};
        entityUpdateData.tick = tick;
        entityUpdateData.entities = new Map();
        let rE = Object.keys(this.removedEntities);
        for (let i = 0; i < rE.length; i++) {
            delete this.removedEntities[rE[i]];
        }
        for (let i = 0; i < removedEntityCount; i++) {
            var uid = buffer.readUint32();
            this.removedEntities[uid] = 1;
        }
        let brandNewEntityTypeCount = buffer.readVarint32();
        for (let i = 0; i < brandNewEntityTypeCount; i++) {
            var brandNewEntityCountForThisType = buffer.readVarint32();
            var brandNewEntityType = buffer.readUint32();
            for (var j = 0; j < brandNewEntityCountForThisType; j++) {
                var brandNewEntityUid = buffer.readUint32();
                this.sortedUidsByType[brandNewEntityType].push(brandNewEntityUid);
            }
        }
        let SUBT = Object.keys(this.sortedUidsByType);
        for (let i = 0; i < SUBT.length; i++) {
            let table = this.sortedUidsByType[SUBT[i]];
            let newEntityTable = [];
            for (let j = 0; j < table.length; j++) {
                let uid = table[j];
                if (!(uid in this.removedEntities)) {
                    newEntityTable.push(uid);
                }
            }
            newEntityTable.sort((a, b) => a - b);
            this.sortedUidsByType[SUBT[i]] = newEntityTable;
        }
        while (buffer.remaining()) {
            let entityType = buffer.readUint32();
            if (!(entityType in this.attributeMaps)) {
                throw new Error('Entity type is not in attribute map: ' + entityType);
            }
            let absentEntitiesFlagsLength = Math.floor((this.sortedUidsByType[entityType].length + 7) / 8);
            this.absentEntitiesFlags.length = 0;
            for (let i = 0; i < absentEntitiesFlagsLength; i++) {
                this.absentEntitiesFlags.push(buffer.readUint8());
            }
            let attributeMap = this.attributeMaps[entityType];
            for (let tableIndex = 0; tableIndex < this.sortedUidsByType[entityType].length; tableIndex++) {
                let uid = this.sortedUidsByType[entityType][tableIndex];
                if ((this.absentEntitiesFlags[Math.floor(tableIndex / 8)] & (1 << (tableIndex % 8))) !== 0) {
                    entityUpdateData.entities.set(uid, true);
                    continue;
                }
                var player = {
                    uid: uid
                };
                this.updatedEntityFlags.length = 0;
                for (let j = 0; j < Math.ceil(attributeMap.length / 8); j++) {
                    this.updatedEntityFlags.push(buffer.readUint8());
                }
                for (let j = 0; j < attributeMap.length; j++) {
                    let attribute = attributeMap[j];
                    let flagIndex = Math.floor(j / 8);
                    let bitIndex = j % 8;
                    let count = void 0;
                    let v = [];
                    if (this.updatedEntityFlags[flagIndex] & (1 << bitIndex)) {
                        switch (attribute.type) {
                            case e_AttributeType.Uint32:
                                player[attribute.name] = buffer.readUint32();
                                break;
                            case e_AttributeType.Int32:
                                player[attribute.name] = buffer.readInt32();
                                break;
                            case e_AttributeType.Float:
                                player[attribute.name] = buffer.readInt32() / 100;
                                break;
                            case e_AttributeType.String:
                                player[attribute.name] = this.safeReadVString(buffer);
                                break;
                            case e_AttributeType.Vector2:
                                let x = buffer.readInt32() / 100;
                                let y = buffer.readInt32() / 100;
                                player[attribute.name] = { x: x, y: y };
                                break;
                            case e_AttributeType.ArrayVector2:
                                count = buffer.readInt32();
                                v = [];
                                for (let i = 0; i < count; i++) {
                                    let x_1 = buffer.readInt32() / 100;
                                    let y_1 = buffer.readInt32() / 100;
                                    v.push({ x: x_1, y: y_1 });
                                }
                                player[attribute.name] = v;
                                break;
                            case e_AttributeType.ArrayUint32:
                                count = buffer.readInt32();
                                v = [];
                                for (let i = 0; i < count; i++) {
                                    let element = buffer.readInt32();
                                    v.push(element);
                                }
                                player[attribute.name] = v;
                                break;
                            case e_AttributeType.Uint16:
                                player[attribute.name] = buffer.readUint16();
                                break;
                            case e_AttributeType.Uint8:
                                player[attribute.name] = buffer.readUint8();
                                break;
                            case e_AttributeType.Int16:
                                player[attribute.name] = buffer.readInt16();
                                break;
                            case e_AttributeType.Int8:
                                player[attribute.name] = buffer.readInt8();
                                break;
                            case e_AttributeType.Uint64:
                                player[attribute.name] = buffer.readUint32() + buffer.readUint32() * 4294967296;
                                break;
                            case e_AttributeType.Int64:
                                let s64 = buffer.readUint32();
                                let s642 = buffer.readInt32();
                                if (s642 < 0) {
                                    s64 *= -1;
                                }
                                s64 += s642 * 4294967296;
                                player[attribute.name] = s64;
                                break;
                            case e_AttributeType.Double:
                                let s64d = buffer.readUint32();
                                let s64d2 = buffer.readInt32();
                                if (s64d2 < 0) {
                                    s64d *= -1;
                                }
                                s64d += s64d2 * 4294967296;
                                s64d = s64d / 100;
                                player[attribute.name] = s64d;
                                break;
                            default:
                                throw new Error('Unsupported attribute type: ' + attribute.type);
                        }
                    }
                }
                entityUpdateData.entities.set(player.uid, player);
            }
        }
        entityUpdateData.byteSize = buffer.capacity();
        return entityUpdateData;
    };
    decodePing() {
        return {};
    };
    encodeRpc(buffer, item) {
        if (!(item.name in this.rpcMapsByName)) {
            throw new Error('RPC not in map: ' + item.name);
        }
        var rpc = this.rpcMapsByName[item.name];
        buffer.writeUint32(rpc.index);
        for (var i = 0; i < rpc.parameters.length; i++) {
            var param = item[rpc.parameters[i].name];
            switch (rpc.parameters[i].type) {
                case e_ParameterType.Float:
                    buffer.writeInt32(Math.floor(param * 100.0));
                    break;
                case e_ParameterType.Int32:
                    buffer.writeInt32(param);
                    break;
                case e_ParameterType.String:
                    buffer.writeVString(param);
                    break;
                case e_ParameterType.Uint32:
                    buffer.writeUint32(param);
                    break;
            }
        }
    };
    decodeRpcObject(buffer, parameters) {
        var result = {};
        for (var i = 0; i < parameters.length; i++) {
            switch (parameters[i].type) {
                case e_ParameterType.Uint32:
                    result[parameters[i].name] = buffer.readUint32();
                    break;
                case e_ParameterType.Int32:
                    result[parameters[i].name] = buffer.readInt32();
                    break;
                case e_ParameterType.Float:
                    result[parameters[i].name] = buffer.readInt32() / 100.0;
                    break;
                case e_ParameterType.String:
                    result[parameters[i].name] = this.safeReadVString(buffer);
                    break;
                case e_ParameterType.Uint64:
                    result[parameters[i].name] = buffer.readUint32() + buffer.readUint32() * 4294967296;
                    break;
            }
        }
        return result;
    };
    decodeRpc(buffer) {
        var rpcIndex = buffer.readUint32();
        var rpc = this.rpcMaps[rpcIndex];
        var result = {
            name: rpc.name,
            response: null
        };
        if (!rpc.isArray) {
            result.response = this.decodeRpcObject(buffer, rpc.parameters);
        }
        else {
            var response = [];
            var count = buffer.readUint16();
            for (var i = 0; i < count; i++) {
                response.push(this.decodeRpcObject(buffer, rpc.parameters));
            }
            result.response = response;
        }
        return result;
    };
    encodeEnterWorld(buffer, item) {
        buffer.writeVString(item.displayName);
        for (var e = new Uint8Array(item.extra), i = 0; i < item.extra.byteLength; i++)
            buffer.writeUint8(e[i]);
    }
    encodeInput(buffer, item) {
        buffer.writeVString(JSON.stringify(item));
    };
    encodePing(buffer) {
        buffer.writeUint8(0);
    };
}

const wasmbuffers = fs.readFileSync("public/zombs_wasm.wasm");

const wasmmodule = () => {
    let uid = 0;
    function _0x13087a() {
        var _0x34bd70 = _0x2f1c30['buffer'];
        _0x127993['HEAP32'] = _0x1c5e05 = new Int32Array(_0x34bd70),
        _0x127993['HEAPU8'] = _0xc81155 = new Uint8Array(_0x34bd70)
    }
    function _0x26b800() {
        _0x54cba0(_0x3a74a4);
    }
    function _0x47c5bf() {
        _0x54cba0(_0x3e4836);
    }
    function _0x2c6d8e() {
        _0x54cba0(_0x391ac0);
    }
    function _0x39d452() {
        _0x54cba0(_0x21d4f6);
    }
    function _0x3ff0ab(_0x24c1b9) {
        _0x3e4836['unshift'](_0x24c1b9);
    }
    function _0x501831(_0x2d1a38) {
        if (_0xc8484a--, 0x0 == _0xc8484a && _0x3f3da9) {
            var _0xb20e55 = _0x3f3da9;
            _0x3f3da9 = null,
            _0xb20e55();
        }
    }
    function _0x5429ef(_0x5cb0d8, _0x424383) {
        WebAssembly['instantiate'](wasmbuffers, _0x5cb0d8).then(e => _0x424383(e));
    }
    function _0x1fc4fa() {
        function _0xb20357(_0x326b75, _0x4aab9b) {
            var _0x3cdfec = _0x326b75['exports'];
            return _0x127993['asm'] = _0x3cdfec,
            _0x2f1c30 = _0x127993['asm']['g'],
            _0x13087a(),
            _0x3f9a5c = _0x127993['asm']['k'],
            _0x3ff0ab(_0x127993['asm']['h']),
            _0x501831('wasm-instantiate'),
            _0x30aada(),
            Module.ready = true,
            Module.opcode5Callback && Module.onDecodeOpcode5(Module.blended, Module.hostname, Module.opcode5Callback),
            _0x3cdfec;
        }
        _0x5429ef({ 'a': _0x958b8f }, (_0x50fbd9) => {
            _0xb20357(_0x50fbd9['instance']);
        });
    }
    function _0x498e67() {
        var _0x1f3c6c = arguments['length'] > 0x0 && void 0x0 !== arguments[0x0] ? arguments[0x0] : [];
        _0x1f3c6c['unshift']('./this.program');
        var _0x3d8fea = _0x1f3c6c['length']
        , _0x519778 = _0x59d06b(0x4 * (_0x3d8fea + 0x1))
        , _0x7ff745 = _0x519778 >> 0x2;
        _0x1f3c6c['forEach'](function(_0x3e02ba) {
            _0x1c5e05[_0x7ff745++] = _0x498482(_0x3e02ba);
        }),
        _0x1c5e05[_0x7ff745] = 0;
        try {
            var _0x310bf7 = _0x127993['asm']['i'](_0x3d8fea, _0x519778);
            return _0xee0c3a(_0x310bf7, !0x0),
            _0x310bf7;
        } catch (_0x4e859e) {}
    }
    function _0x30aada() {
        function _0x4d7107() {
            _0x4f880a || (_0x4f880a = 1, _0x5f1e4e || (_0x47c5bf(), _0x2c6d8e(), _0x498e67([]), _0x39d452()));
        }
        _0xc8484a > 0x0 || (_0x26b800(), _0xc8484a > 0x0 || _0x4d7107());
    }

    var _0x127993 = {}, _0x30084d = 0, _0x1d39c6 = '';
    _0x30084d && (_0x30084d ? _0x1d39c6 = self['location']['href'] : 'undefined' != typeof document && document['currentScript'] && (_0x1d39c6 = document['currentScript']['src']),
    _0x1d39c6 = 0x0 !== _0x1d39c6['indexOf']('blob:') ? _0x1d39c6['substr'](0x0, _0x1d39c6['replace'](/[?#].*/, '')['lastIndexOf']('/') + 0x1) : '',
    _0x30084d);
    var _0x2f1c30, _0x5f1e4e = !0x1, _0xc81155, _0x1c5e05, _0x3f9a5c, _0x3a74a4 = [], _0x3e4836 = [], _0x391ac0 = [], _0x21d4f6 = [], _0xc8484a = 0x0, _0x3f3da9 = null;
    var _0x54cba0 = function(_0x5ea8a6) {
        for (; _0x5ea8a6['length'] > 0x0; ) _0x5ea8a6['shift']()(_0x127993);
    }, _0x159858 = new TextDecoder('utf8')
    , _0x2e2782 = function(_0x2ffcf0, _0x10af85, _0xea946b) {
        for (var _0x480575 = _0x10af85 + _0xea946b, _0x2f7ef6 = _0x10af85; _0x2ffcf0[_0x2f7ef6] && !(_0x2f7ef6 >= _0x480575); ) ++_0x2f7ef6;
        if (_0x2f7ef6 - _0x10af85 > 0x10 && _0x2ffcf0['buffer'] && _0x159858) return _0x159858['decode'](_0x2ffcf0['subarray'](_0x10af85, _0x2f7ef6));
        for (var _0x2c39f4 = ''; _0x10af85 < _0x2f7ef6; ) {
            var _0x42017e = _0x2ffcf0[_0x10af85++];
            if (0x80 & _0x42017e) {
                var _0x183cb3 = 0x3f & _0x2ffcf0[_0x10af85++];
                if (0xc0 != (0xe0 & _0x42017e)) {
                    var _0x46fba6 = 0x3f & _0x2ffcf0[_0x10af85++];
                    if (_0x42017e = 0xe0 == (0xf0 & _0x42017e) ? (0xf & _0x42017e) << 0xc | _0x183cb3 << 0x6 | _0x46fba6 : (0x7 & _0x42017e) << 0x12 | _0x183cb3 << 0xc | _0x46fba6 << 0x6 | 0x3f & _0x2ffcf0[_0x10af85++],
                    _0x42017e < 0x10000)
                        _0x2c39f4 += String['fromCharCode'](_0x42017e);
                    else {
                        var _0x2eaebb = _0x42017e - 0x10000;
                        _0x2c39f4 += String['fromCharCode'](0xd800 | _0x2eaebb >> 0xa, 0xdc00 | 0x3ff & _0x2eaebb);
                    }
                } else _0x2c39f4 += String['fromCharCode']((0x1f & _0x42017e) << 0x6 | _0x183cb3);
            } else _0x2c39f4 += String['fromCharCode'](_0x42017e);
        }
        return _0x2c39f4;
    }
    , _0x5c5b0b = function(_0x5cadcf, _0x7a47ff) {
        return _0x5cadcf ? _0x2e2782(_0xc81155, _0x5cadcf, _0x7a47ff) : '';
    }
    , _0x2b2add = function _0x1db85d(_0x537289) {
        return 0x0 | idk(_0x5c5b0b(_0x537289));
    }
    , _0x423fba = function(_0x2585f7) {
        for (var _0x45a3cb = 0x0, _0x1fa63c = 0x0; _0x1fa63c < _0x2585f7['length']; ++_0x1fa63c) {
            var _0x1e09bb = _0x2585f7['charCodeAt'](_0x1fa63c);
            _0x1e09bb <= 0x7f ? _0x45a3cb++ : _0x1e09bb <= 0x7ff ? _0x45a3cb += 0x2 : _0x1e09bb >= 0xd800 && _0x1e09bb <= 0xdfff ? (_0x45a3cb += 0x4,
            ++_0x1fa63c) : _0x45a3cb += 0x3;
        }
        return _0x45a3cb;
    }
    , _0x4632bd = function(_0x5548d6, _0x1c8650, _0xd848c8, _0x1dd96c) {
        if (!(_0x1dd96c > 0x0))
            return 0x0;
        for (var _0x1d2343 = _0xd848c8, _0x3f1f73 = _0xd848c8 + _0x1dd96c - 0x1, _0x32f67c = 0x0; _0x32f67c < _0x5548d6['length']; ++_0x32f67c) {
            var _0x49e781 = _0x5548d6['charCodeAt'](_0x32f67c);
            if (_0x49e781 >= 0xd800 && _0x49e781 <= 0xdfff) {
                var _0x42c6f0 = _0x5548d6['charCodeAt'](++_0x32f67c);
                _0x49e781 = 0x10000 + ((0x3ff & _0x49e781) << 0xa) | 0x3ff & _0x42c6f0;
            }
            if (_0x49e781 <= 0x7f) {
                if (_0xd848c8 >= _0x3f1f73) break;
                _0x1c8650[_0xd848c8++] = _0x49e781;
            } else {
                if (_0x49e781 <= 0x7ff) {
                    if (_0xd848c8 + 0x1 >= _0x3f1f73) break;
                    _0x1c8650[_0xd848c8++] = 0xc0 | _0x49e781 >> 0x6,
                    _0x1c8650[_0xd848c8++] = 0x80 | 0x3f & _0x49e781;
                } else {
                    if (_0x49e781 <= 0xffff) {
                        if (_0xd848c8 + 0x2 >= _0x3f1f73) break;
                        _0x1c8650[_0xd848c8++] = 0xe0 | _0x49e781 >> 0xc,
                        _0x1c8650[_0xd848c8++] = 0x80 | _0x49e781 >> 0x6 & 0x3f,
                        _0x1c8650[_0xd848c8++] = 0x80 | 0x3f & _0x49e781;
                    } else {
                        if (_0xd848c8 + 0x3 >= _0x3f1f73) break;
                        _0x1c8650[_0xd848c8++] = 0xf0 | _0x49e781 >> 0x12,
                        _0x1c8650[_0xd848c8++] = 0x80 | _0x49e781 >> 0xc & 0x3f,
                        _0x1c8650[_0xd848c8++] = 0x80 | _0x49e781 >> 0x6 & 0x3f,
                        _0x1c8650[_0xd848c8++] = 0x80 | 0x3f & _0x49e781;
                    }
                }
            }
        }
        return _0x1c8650[_0xd848c8] = 0x0,
        _0xd848c8 - _0x1d2343;
    }
    , _0x83e63a = function(_0x2ef8fa, _0x9e4b81, _0x308fad) {
        return _0x4632bd(_0x2ef8fa, _0xc81155, _0x9e4b81, _0x308fad);
    },
    idk = (str) => {
        if (str.startsWith('typeof window === "undefined" ? 1 : 0')) return 0;
        if (str.startsWith("typeof process !== 'undefined' ? 1 : 0")) return 0;
        if (str.startsWith('Game.currentGame.network.connected ? 1 : 0')) return 1;
        if (str.startsWith('Game.currentGame.network.connectionOptions.ipAddress')) return Module.hostname;
        if (str.startsWith('Game.currentGame.world.myUid === null ? 0 : Game.currentGame.world.myUid')) return ((uid++) ? 0 : 696969);
        if (str.startsWith('document.getElementById("hud").children.length')) return 24;
    }
    , _0x4676fc = function _0x2bacf2(_0x2ef487) {
        var _0x5a1a54 = idk(_0x5c5b0b(_0x2ef487));
        if (null == _0x5a1a54)
            return 0x0;
        _0x5a1a54 += '';
        var _0x276723 = _0x2bacf2
        , _0x205d5e = _0x423fba(_0x5a1a54);
        return (!_0x276723['bufferSize'] || _0x276723['bufferSize'] < _0x205d5e + 0x1) && (_0x276723['bufferSize'] && _free(_0x276723['buffer']),
        _0x276723['bufferSize'] = _0x205d5e + 0x1,
        _0x276723['buffer'] = _0x8130eb(_0x276723['bufferSize'])),
        _0x83e63a(_0x5a1a54, _0x276723['buffer'], _0x276723['bufferSize']),
        _0x276723['buffer'];
    }
    , _0x262140 = function(_0x484237) {
        _0xd4b1cb = _0x484237,
        _0x5f1e4e = 1;
    }
    , _0xee0c3a = function(_0x2b77c7, _0xdbacc7) {
        _0xd4b1cb = _0x2b77c7,
        _0x262140(_0x2b77c7);
    }
    , _0x498482 = function(_0x2daf45) {
        var _0x471f3d = _0x423fba(_0x2daf45) + 0x1
        , _0x4cf01e = _0x59d06b(_0x471f3d);
        return _0x83e63a(_0x2daf45, _0x4cf01e, _0x471f3d), _0x4cf01e;
    }
    , _0x2e6117 = function(_0x4170b8) {
        var _0x4971bc = _0xc81155['length'];
        _0x4170b8 >>>= 0x0;
        var _0x1ae657 = 0x80000000;
        if (_0x4170b8 > _0x1ae657)
            return !0x1;
        for (var _0x1c95a7 = function(_0x284eea, _0x46b8b0) {
            return _0x284eea + (_0x46b8b0 - _0x284eea % _0x46b8b0) % _0x46b8b0;
        }, _0x361bab = 0x1; _0x361bab <= 0x4; _0x361bab *= 0x2) {
            var _0x39cb04 = _0x4971bc * (0x1 + 0.2 / _0x361bab);
            _0x39cb04 = Math['min'](_0x39cb04, _0x4170b8 + 0x6000000);
            var _0x43c675 = Math['min'](_0x1ae657, _0x1c95a7(Math['max'](_0x4170b8, _0x39cb04), 0x10000))
              , _0x5a45a8 = _0xbaf881(_0x43c675);
            if (_0x5a45a8)
                return !0x0;
        }
        return !0x1;
    }
    , _0xbaf881 = function(_0x10402c) {
        var _0x1bbcae = _0x2f1c30['buffer']
          , _0x167e85 = _0x10402c - _0x1bbcae['byteLength'] + 0xffff >>> 0x10;
        try {
            return _0x2f1c30['grow'](_0x167e85),
            _0x13087a(),
            0x1;
        } catch (_0x202681) {}
    }
    , _0xdd7453 = function(_0x5edbee, _0x22b3cc, _0x52aafd) {
        return _0xc81155['copyWithin'](_0x5edbee, _0x22b3cc, _0x22b3cc + _0x52aafd);
    }
    , _0x958b8f = {
        'd': () => console.error(" "),
        'f': _0xdd7453,
        'c': _0x2b2add,
        'e': _0x2e6117,
        'b': _0x4676fc,
        'a': () => {}
    }
    _0x1fc4fa()
    var _0x8130eb = function() {
        return (_0x8130eb = _0x127993['asm']['l'])['apply'](null, arguments);
    }
    , _0x59d06b = function() {
        return (_0x59d06b = _0x127993['asm']['o'])['apply'](null, arguments);
    };
    var _0x4f880a;
    _0x3f3da9 = function _0x403cef() {
        _0x4f880a || _0x30aada(),
        _0x4f880a || (_0x3f3da9 = _0x403cef);
    }

    const Module = _0x127993;

    Module.decodeBlendInternal = blended => {
        Module.asm.j(24, 132);
        const pos = Module.asm.j(228, 132);
        const extra = new Uint8Array(blended);
        for (let i = 0; i < 132; i++) {
            Module.HEAPU8[pos + i] = extra[i + 1];
        }
        Module.asm.j(172, 36);
        const index = Module.asm.j(4, 152);
        const arraybuffer = new ArrayBuffer(64);
        const list = new Uint8Array(arraybuffer);
        for (let i = 0; i < 64; i++) {
            list[i] = Module.HEAPU8[index + i];
        }
        return arraybuffer;
    };

    Module.onDecodeOpcode5 = (blended, hostname, callback) => {
        Module.blended = blended;
        Module.hostname = hostname;
        if (!Module.ready) return (Module.opcode5Callback = callback);
        Module.asm.j(255, 140);
        const decoded = Module.decodeBlendInternal(blended);
        const mcs = Module.asm.j(187, 22);
        const opcode6Data = [6];
        for (let i = 0; i < 16; i++) {
            opcode6Data.push(Module.HEAPU8[mcs + i]);
        }
        callback({5: decoded, 6: new Uint8Array(opcode6Data)});
    };

    Module.finalizeOpcode10 = blended => {
        const decoded = Module.decodeBlendInternal(blended);
        const list = new Uint8Array(decoded);
        const data = [10];
        for (let i = 0; i < decoded.byteLength; i++) {
            data.push(list[i]);
        }
        return new Uint8Array(data);
    };
    return Module;
}


let codec = new BinCodec();