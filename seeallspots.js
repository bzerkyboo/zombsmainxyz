const serverspots = {
}

let mustNotInclude = {
    "yaw": 0,
    "health": 100,
    "maxHealth": 100,
    "damage": 10,
    "height": 32,
    "width": 32,
    "collisionRadius": 70,
    "entityClass": "Prop",
    "dead": 0,
    "timeDead": 0,
    "slowed": 0,
    "stunned": 0,
    "hits": [],
    "interpolatedYaw": 0
}

const toInclude = (entity) => {
    for (let i in mustNotInclude) {
        entity[i] = mustNotInclude[i];
    }
    return entity;
}
const getRealPosOfIndex = (index) => {
    return {
        x: ((((index * 100).toFixed(2) - "") % 5000000) | 0) / 100,
        y: (index / 50000 | 0) / 100
    }
}

const decodeSpotJSON = (json) => {
    let arr = JSON.parse(json);
    let obj = {};
    for (let i = 0; i < arr.length; i++) {
        arr[i] && (obj[i + 1] = {
            model: detectModelByUid(i + 1),
            position: getRealPosOfIndex(arr[i]),
            uid: i + 1
        });
    }
    return obj;
}

let detectModelByUid = (uid) => {
    if (0 < uid && uid <= 400) {
        return "Tree";
    }
    if (400 < uid && uid <= 800) {
        return "Stone";
    }
    if (800 < uid && uid <= 825) {
        return "NeutralCamp";
    }
}

// keeps trees, stones and camps
game.world.removeEntity2 = game.world.removeEntity;
game.world.removeEntity = (uid) => {
    if (game.world.entities.get(uid).fromTick.model == "Tree" || game.world.entities.get(uid).fromTick.model == "Stone" || game.world.entities.get(uid).fromTick.model == "NeutralCamp") return;
    game.world.removeEntity2(uid);
};

game.world.oldCreateEntity = game.world.createEntity;
game.world.createEntity = e => {
    if (document.disableZombieEntity && (e.entityClass == "Npc" && !e.model.startsWith("ZombieBossTier"))) return;
    if (document.disableProjectileEntity && e.entityClass == "Projectile") return;
    if (document.disableTowerEntity && (e.model == "Door" || e.model == "Wall" || e.model == "SlowTrap" || e.model == "ArrowTower" || e.model == "CannonTower" || e.model == "BombTower" || e.model == "MeleeTower" || e.model == "MagicTower" || e.model == "Harvester" || e.model == "GoldMine")) return;
    if (game.world.entities.get(e.uid)) return;
    if (e.entityClass) {
        game.world.oldCreateEntity(e);
    }
}

game.network.addPacketHandler(4, data => {
    if (data.allowed) {
        if (serverspots[game.options.serverId]) {
            let spots = decodeSpotJSON(serverspots[game.options.serverId].spotEncoded);
            game.world.spots = spots;
            game.world.toInclude = toInclude;
            for (let i in spots) {
                let entity = toInclude(spots[i]);
                game.world.createEntity(entity);
            }
        }
    }
});

// apex zoom

let dimension = 1;

const onWindowResize = async () => {
    const renderer = Game.currentGame.renderer;
    if (!renderer.renderer) return;
    let canvasWidth = window.innerWidth * window.devicePixelRatio;
    let canvasHeight = window.innerHeight * window.devicePixelRatio;
    let ratio = Math.max(canvasWidth / (1920 * dimension), canvasHeight / (1080 * dimension));
    renderer.scale = ratio;
    renderer.entities.setScale(ratio);
    renderer.ui.setScale(ratio);
    renderer.renderer.resize(canvasWidth, canvasHeight);
    renderer.viewport.width = renderer.renderer.width / renderer.scale + 2 * renderer.viewportPadding;
    renderer.viewport.height = renderer.renderer.height / renderer.scale + 2 * renderer.viewportPadding;
}

onWindowResize();

window.onresize = onWindowResize;

window.onwheel = e => {
    if (e.deltaY > 0) {
        dimension = Math.min(50, dimension + 1);
        onWindowResize();
    } else if (e.deltaY < 0) {
        dimension = Math.max(1, dimension - 1);
        onWindowResize();
    }
}