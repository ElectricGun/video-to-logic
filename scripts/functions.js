const mlogCodes = require("v2logic/mlogs")
const config = JSON.parse(Jval.read(Vars.tree.get("data/config.hjson").readString()))
const modVersion = config.rendererVersion

function mulberry32(a) {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

function placeBlock(x, y, block, config) {
    let tile = Vars.world.tile(x, y)
    tile.setBlock(block, Team.sharded)
    if (config != undefined) {
        Vars.world.build(x, y).configure(config)
    }
}

function placeProcessor(x, y, block, code, links) {


    let tile = Vars.world.tile(x, y)
    tile.setBlock(block, Team.sharded)
    
    let currProcessor = Vars.world.build(x, y)

    if (code != undefined) {
        currProcessor.updateCode(code)
    }

    if (links != undefined) {
        try {
            links[0]
            for (let i = 0; i < links.length; i++) {
                currProcessor.links.add(links[i])
            }
        } catch (e) {
            currProcessor.links.add(links)
        }
    }
}

function dist(x0, y0, x1, y1) {
    let distance = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2))
    return distance
}

function defineFrameSize(animationFrame) {    //   O(n) where n = number of pixels
    let x = 0
    let y = 0
    for (let i = 0; i < animationFrame.length; i++) {
        let pixel = animationFrame[i]
        let currX = pixel[1]
        let currY = pixel[2]

        if (currX > x) {
            x = currX
        }
        if (currY > y) {
            y = currY
        }
    }
    return {x: x, y: y}
}

function defineDisplayPositionAndOffset(x, y, size) {
    let newPosition = new Vec2(x % size, y % size)
    let displayOffset = new Vec2(Math.floor(x / size), Math.floor(y / size))

    return {displayOffset: displayOffset, x: newPosition.x, y: newPosition.y}
}

function checkTiles(x, y, size) {
    let isOdd = (size % 2);
    let gutter = (size - isOdd) / 2;
    let startingPoint = new Vec2(x - gutter, y - gutter);

    if (!isOdd) {
        startingPoint.add(1, 1)
    };

    let offset = new Vec2(0, 0);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            let build = Vars.world.build(startingPoint.x + offset.x, startingPoint.y + offset.y);
            let tile = Vars.world.tile(startingPoint.x + offset.x, startingPoint.y + offset.y);
            if (build != null) {
                return true;
            };
            offset.y += 1;
        };
        offset.y = 0;
        offset.x += 1;
    };
}

function spiral(n, step, squishX, squishY) {
    let dist = 0
    let dir = 0    //0 right, 1 up, 2 left, 3 down
    let outX = 0
    let outY = 0
    let counter = 0
    let switches = 0

    for (let i = 0; i < n; i++) {

        if (counter > dist) {
            if ((switches % 2)) {
                dist += 1
            }
            dir += 1
            dir %= 4
            counter = 0
            switches += 1
        }
        if        (dir == 0) {
            outX += (step - squishX)
        } else if (dir == 1) {
            outY += (step - squishY)
        } else if (dir == 2) {
            outX -= (step - squishX)
        } else if (dir == 3) {
            outY -= (step - squishY)
        }
        counter += 1
    }

    return {x: outX, y: outY}
}

function placeCryo(centerPos) {
    let offset = -2

    for (let i = 0; i < 2; i++) {
        let pointerBlock = Vars.world.build(centerPos.x + offset, centerPos.y)
        if (pointerBlock != null) {
            pointerBlock = pointerBlock.block
        } else {
            pointerBlock = "null"
        }

        if (pointerBlock != "hyper-processor") {
            let cryoPos = Vec2(centerPos.x + offset, centerPos.y)
            placeBlock(cryoPos.x, cryoPos.y, Blocks.liquidSource, Liquids.cryofluid)
        }
        offset += 4
    }
}

function getProcessorType(processorTypeStr) {
    //    No modded processor support, sad
    let processorTypes = {
        microProcessor: {block: Blocks.microProcessor, size: 1, squishX: 0, squishY: 0, range: 10},
        logicProcessor: {block: Blocks.logicProcessor, size: 2, squishX: 0, squishY: 0, range: 22},
        hyperProcessor: {block: Blocks.hyperProcessor, size: 4, squishX: 0.5, squishY: 1, range: 42},
        worldProcessor: {block: Blocks.worldProcessor, size: 1, squishX: 0, squishY: 0, range: Vars.world.width / 2}
    }

    let processorType
    try{
        processorType = processorTypes[processorTypeStr]
    } catch (e) {
        Log.infoTag("v2logic","[ERROR] Invalid processor type")
        Vars.ui.showInfoPopup("[ERROR] Invalid processor type", 1, 1, 1, 1, 1, 1)
        return
    }
    return processorType
}

function placeWalls(startingPosition, processorTypeStr) {
    //    Filler walls
    let walls = [
                [1, 1, 1, 0, 1, 0],
                [1, 1, 1, 1, 1, 0],
                [1, 1, 1, 0, 1, 0],    
                [0, 0, 1, 1, 1, 1]
    ].reverse()

    //    Wall offset relative to startingPosition
    const wallOffset = new Vec2(-2, 4)

    let outWalls = []

    //    Surround clock processor with walls
    if (processorTypeStr == "worldProcessor" || processorTypeStr == "worldProcessor") {
        for (let y = 0; y < walls.length; y++) {
            for (let x = 0; x < walls[y].length; x++) {
                let currentWall = walls[y][x]
                if (currentWall == 1) {
                    outWalls.push({type: "block", x: startingPosition.x + wallOffset.x + x, y: startingPosition.y + wallOffset.y + y, block: Blocks.copperWall, config: undefined})
                }
            }
        }
    }

    outWalls.forEach(b => {
        if (b.type == "block") {
            placeBlock(b.x, b.y, b.block, b.config)
        } else if(b.type == "processor") {
            placeProcessor(b.x, b.y, b.block, b.code, b.links)
        } else {
            Log.infoTag("v2logic","[ERROR] Invalid block type... skipping")
            Vars.ui.showInfoPopup("[ERROR] Invalid block type... skipping", 1, 1, 1, 1, 1, 1)
        }
    })
}

function placeStartingBlocks(startingPosition, processorTypeStr, configLinks, displayAmount, animation, animationInfo) {

    //    Define the starting tiles
    let startingTiles = [
        {type: "block", x: startingPosition.x - 2, y: startingPosition.y + 4, block: Blocks.memoryCell,        config: undefined},
        {type: "block", x: startingPosition.x - 1, y: startingPosition.y + 4, block: Blocks.switchBlock,       config: false},
        {type: "block", x: startingPosition.x + 3, y: startingPosition.y + 5, block: Blocks.memoryCell,        config: undefined},
        {type: "processor", x: startingPosition.x + 3, y: startingPosition.y + 6, block: Blocks.microProcessor, code: mlogCodes.config.replace(/_FPS_/g, animation[0].fps / animation[0].step)
                                                                                                                                        .replace(/_DISPLAYCOUNT_/g, displayAmount.x * displayAmount.y), links: configLinks},
        {type: "block", x: startingPosition.x + 1, y: startingPosition.y + 7, block: Blocks.message,        config: "Animation name: [lime]" + animationInfo[0] + "\n\n[white]Generated using the mod: [red]ElectricGun/Video-to-Logic  version [lime]" + modVersion},
        {type: "block", x: startingPosition.x + 3, y: startingPosition.y + 7, block: Blocks.message,        config: "Config Processor: \n\nTweak the [purple]set [white]variable values to modify the playback"}                                                                        
                                                                                                                                        
    ]

    if (processorTypeStr == "hyperProcessor") {
        startingTiles.push({type: "block", x: startingPosition.x + 3, y: startingPosition.y + 4, block: Blocks.liquidSource,      config: Liquids.cryofluid})
    }

    //    Place initial blocks
    startingTiles.forEach(b => {
        if (b.type == "block") {
            placeBlock(b.x, b.y, b.block, b.config)
        } else if(b.type == "processor") {
            placeProcessor(b.x, b.y, b.block, b.code, b.links)
        } else {
            Log.infoTag("v2logic","[ERROR] Invalid block type... skipping")
            Vars.ui.showInfoPopup("[ERROR] Invalid block type... skipping", 1, 1, 1, 1, 1, 1)
        }
    })
}

function defineMainLinks(startingPosition) {
    //    Define links for graphic processors
    let mainLinks = [
        new LogicBlock.LogicLink(startingPosition.x - 2, startingPosition.y + 4, "cell1", true),
        new LogicBlock.LogicLink(startingPosition.x + 3, startingPosition.y + 5, "cell2", true),
        new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
    ]

    return mainLinks
}

function defineConfigLinks(startingPosition) {
    //    Define links for the config processor
    let configLinks = [
        new LogicBlock.LogicLink(startingPosition.x + 3, startingPosition.y + 5, "cell1", true),
        new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
    ]

    return configLinks
}

// ---- logging TODO ---- //

function flushLog(filename, logs) {}

module.exports = {
    mulberry32: mulberry32,
    defineConfigLinks: defineConfigLinks,
    defineMainLinks: defineMainLinks,
    placeStartingBlocks: placeStartingBlocks,
    placeWalls: placeWalls,
    getProcessorType: getProcessorType,
    placeCryo: placeCryo,
    dist: dist,
    spiral: spiral,
    checkTiles: checkTiles,
    defineFrameSize: defineFrameSize,
    placeProcessor: placeProcessor,
    placeBlock: placeBlock,
    defineDisplayPositionAndOffset: defineDisplayPositionAndOffset,
    

}

    
