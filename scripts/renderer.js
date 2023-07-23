const modVersion = "1.03"

/*TODO:

    Use another thread to process to fix that annoying lag spike

    Fix lag when using hyper processors

    Variable size depending on the number of pixels in a frame and colour variety
        
    Fix crusty:

        -Dont draw single frames in parallel to reduce crust.                                    DONE
        -Draw a frame only twice or a few times to prevent omega level crusting.                 DONE
        -Lock write to cell 0 in frame clock when a draw job is active.                          DONE
            -Stop drawing if lock == 1
            -Only reset lock in clock

            This slows down the animation to sync with graphics processors to reduce crust. Maybe not a good thing.
            
        Theres still a bit of crust on keyframes when the ipt is above 750 or so. This is probably something to do with the nature of the game.

    Add option for other processors.                                                             DONE

    Set ipt of World processors to 25 when switch is disabled to reduce lag                      DONE

    Add programmable settings, like ipt and refreshes per cycle.                                 DONE

    Multi display:
        Use tile checks instead of square boundaries.
        Maybe group up draw functions per display to reduce code size.
        Check only if flushing processors are in range

        FIX MULTIDISPLAY CRUST:
            -Fix incorrect display flushing

            -Probably remove the first displayflush

    Optimise if i have to.

    Convert lazy copy paste to functions

    Clean up code.

    To do later:

        Framebuffer:
            -Instead of drawing straight into the display, write packed pixel values into membanks and have dedicated gpus to draw them.
            This will probably speed up render time at the cost of being more spacious.
            -Let this be toggleable.
            -Add checking of tiles to prevent overwriting memcells.
*/

const config = JSON.parse(Jval.read(Vars.tree.get("data/config.hjson").readString()))

const mlogCodes = require("v2logic/mlogs")

const palette = [
    [217, 157, 115], [140, 127, 169], [235, 238, 245], [149, 171, 217], //copper, lead, metaglass, graphite
    [247, 203, 164], [39, 39, 39], [141, 161, 227], [249, 163, 199],    //sand, coal, titanium, thorium
    [119, 119, 119], [83, 86, 92], [203, 217, 127], [244, 186, 110],    //scrap, silicon, plastanium, phase
    [243, 233, 121], [116, 87, 206], [255, 121, 94], [255, 170, 95],    //surge, spore, blast, pyratite
    [58, 143, 100], [118, 138, 154], [227, 255, 214], [137, 118, 154],  //beryllium, tungsten, oxide, carbide
    [94, 152, 141], [223, 130, 77]                                      //fissileMatter, dormantCyst
]

var activeAnimations = []
var queue = []

function defineAnimation (name) {
    let animation = []
    let totalBatches, data, header
    try {
    header = JSON.parse(Vars.tree.get("animations/" + name + "/" + "frame" + "config.json").readString())
        for (let i = 0;i < header.totalBatches; i++) {
            data = JSON.parse(Vars.tree.get("animations/" + name + "/" + "frame" + i + ".json").readString())
            animation.push(data)
        }
        totalBatches = header.totalBatches;
    } catch (e) {
        Log.infoTag("v2logic", e)
    }
    return {animation: animation, header: header, totalBatches: totalBatches, name: name}
}

function addToQueue(name, compression, scale, processorType, messageBlock) {
    let x = messageBlock.x / 8
    let y = messageBlock.y / 8
    let data = [name, Vec2(x, y), compression, processorType, Math.floor(scale)]
    queue.push(data)
}

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

function render () {    //    main function
    let animationInfo = queue[0]
    let startTime = Time.millis()
    let startingPosition, frame, data, displayName, compression, processorTypeStr, scale

    try {
        startingPosition = animationInfo[1]
        compression = animationInfo[2]
        processorTypeStr = animationInfo[3]
        scale = animationInfo[4]
        displayName = (startingPosition.x * Vars.world.height() + startingPosition.y).toString(16).slice(2)
    } catch (error) {

        return
    }

    //if (activeAnimations[0] != null) {return} //enables queueing

    if (compression < 0) {
        Log.infoTag("v2logic", "[ERROR] Argument compression must be greater than 0")
        Vars.ui.showInfoPopup("[ERROR] Argument compression must be greater than 0", 1, 1, 1, 1, 1, 1)
        return
    }

    activeAnimations.splice(-1, 0, displayName)
    let animationData, animation, header, totalBatches, isRaw
    try {
        animationData = defineAnimation(animationInfo[0])
        animation = animationData.animation
        header = animationData.header
        totalBatches = animationData.totalBatches
        //let compressionType = header.compressed
        isRaw = header.isRaw
    } catch(e) {
        Log.infoTag("v2logic", "[ERROR] Invalid animation folder")
        Vars.ui.showInfoPopup("[ERROR] Invalid animation folder", 1, 1, 1, 1, 1, 1)
        queue.splice(0, 1)
    }
    queue.splice(0, 1)

    try {

        startTime = Time.millis()
        
        let totalFrames = 0
        let step = animation[0].step

        for (let i = 0; i < totalBatches; i++) {
            totalFrames += animation[i].batchSize
        };

        //    Reset log
        Vars.tree.get("logs/mlogs.txt").writeString(" ")
    
        //    Define animation size and number of displays
        let size = defineFrameSize(animation[0].seq[0])
        const displaySize = 180
        const offsetOneMult = new Vec2((size.x + 1) / size.x, (size.y + 1) / size.y)    //    Multiply pixels by this so that it fits the display
        const displayAmount = new Vec2(Math.ceil((size.x * scale) / displaySize), Math.ceil((size.y * scale) / displaySize))
        let displayTiles = []

        //    Define the displays and their links
        let displayLinks = []
        let displayOffset = new Vec2(0, 0)
        let displayCounter = 0
        const displayStartingPosition = new Vec2(startingPosition.x + ((displayAmount.x - 1) * -6), startingPosition.y + ((displayAmount.y - 1) * -6))

        let displayIDArray = []

        for (let y = 0; y < displayAmount.y; y++) {
            let displayIDArrayRow = []
            for (let x = 0; x < displayAmount.x; x++) {
                displayCounter += 1

                let displayID = "display" + displayCounter
                displayIDArrayRow.push(displayID)

                displayLinks.push(new LogicBlock.LogicLink(displayStartingPosition.x + displayOffset.x, displayStartingPosition.y + displayOffset.y, displayID, true))
                displayTiles.push({type: "block",       x: displayStartingPosition.x + displayOffset.x, y: displayStartingPosition.y + displayOffset.y, block: Blocks.largeLogicDisplay, config: undefined})
                displayOffset.x += 6
            }
            displayIDArray.push(displayIDArrayRow)
            displayOffset.x = 0
            displayOffset.y += 6
        }

        //    Define links for graphic processors
        let mainLinks = [
            new LogicBlock.LogicLink(startingPosition.x - 2, startingPosition.y + 4, "cell1", true),
            new LogicBlock.LogicLink(startingPosition.x + 3, startingPosition.y + 5, "cell2", true),
            new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
        ]

        mainLinks = mainLinks.concat(displayLinks)

        //    Define links for the config processor
        let configLinks = [
            new LogicBlock.LogicLink(startingPosition.x + 3, startingPosition.y + 5, "cell1", true),
            new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
        ]

        //    Define the starting tiles
        let startingTiles = [
            {type: "block", x: startingPosition.x - 2, y: startingPosition.y + 4, block: Blocks.memoryCell,        config: undefined},
            {type: "block", x: startingPosition.x - 1, y: startingPosition.y + 4, block: Blocks.switchBlock,       config: false},
            {type: "block", x: startingPosition.x + 3, y: startingPosition.y + 5, block: Blocks.memoryCell,        config: undefined},
            {type: "processor", x: startingPosition.x + 3, y: startingPosition.y + 6, block: Blocks.microProcessor, code: mlogCodes.config.replace(/_FPS_/g, animation[0].fps / step)
                                                                                                                                          .replace(/_DISPLAYCOUNT_/g, displayAmount.x * displayAmount.y), links: configLinks},
            {type: "block", x: startingPosition.x + 1, y: startingPosition.y + 7, block: Blocks.message,        config: "Animation name: [lime]" + animationInfo[0] + "\n\n[white]Generated using the mod: [red]ElectricGun/Video-to-Logic  version [lime]" + modVersion},
            {type: "block", x: startingPosition.x + 3, y: startingPosition.y + 7, block: Blocks.message,        config: "Config Processor: \n\nTweak the [purple]set [white]variable values to modify the playback"}                                                                        
                                                                                                                                          
        ]

        if (processorTypeStr == "hyperProcessor") {
            startingTiles.push({type: "block", x: startingPosition.x + 3, y: startingPosition.y + 4, block: Blocks.liquidSource,      config: Liquids.cryofluid})
        }

        //    Filler walls
        let walls = [
                    [1, 1, 1, 0, 1, 0],
                    [1, 1, 1, 1, 1, 0],
                    [1, 1, 1, 0, 1, 0],    
                    [0, 0, 1, 1, 1, 1]
        ].reverse()

        //    Wall offset relative to startingPosition
        const wallOffset = new Vec2(-2, 4)

        //    Surround clock processor with walls
        if (processorTypeStr == "worldProcessor" || processorTypeStr == "worldProcessor") {
            for (let y = 0; y < walls.length; y++) {
                for (let x = 0; x < walls[y].length; x++) {
                    let currentWall = walls[y][x]
                    if (currentWall == 1) {
                        startingTiles.push({type: "block", x: startingPosition.x + wallOffset.x + x, y: startingPosition.y + wallOffset.y + y, block: Blocks.copperWall,        config: undefined})
                    }
                }
            }
        }

        /*    For vram storage etc, not gonna do probably
        let graphicsTiles = [
            //    First column
            {type: "processor", x: startingPosition.x + 5, y: startingPosition.y + 5,         block: Blocks.hyperProcessor, code: "", links: mainLinks},
            {type: "processor", x: startingPosition.x + 5, y: startingPosition.y + 5 - 3,     block: Blocks.hyperProcessor, code: "", links: mainLinks},
            {type: "processor", x: startingPosition.x + 5, y: startingPosition.y + 5 - 3 - 3, block: Blocks.hyperProcessor, code: "", links: mainLinks},

            //    Second column
            {type: "processor", x: startingPosition.x + 5 + 4, y: startingPosition.y + 5,         block: Blocks.hyperProcessor, code: "", links: mainLinks},
            {type: "processor", x: startingPosition.x + 5 + 4, y: startingPosition.y + 5 - 3,     block: Blocks.hyperProcessor, code: "", links: mainLinks},
            {type: "processor", x: startingPosition.x + 5 + 4, y: startingPosition.y + 5 - 3 - 3, block: Blocks.hyperProcessor, code: "", links: mainLinks},

            {type: "block", x: startingPosition.x + 7, y: startingPosition.y + 5, block: Blocks.liquidSource, config: Liquids.cryofluid},
            {type: "block", x: startingPosition.x + 7, y: startingPosition.y + 5 - 3, block: Blocks.liquidSource, config: Liquids.cryofluid},
            {type: "block", x: startingPosition.x + 7, y: startingPosition.y + 5 - 3, block: Blocks.liquidSource, config: Liquids.cryofluid}
        ]
        */

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

        //    Place logic displays
        displayTiles.forEach(b => {
            if (b.type == "block") {
                try {
                    placeBlock(b.x, b.y, b.block, b.config)
                } catch (e) {
                    Log.infoTag("v2logic", "[ERROR] Error when placing displays, is your animation too large?")
                    Vars.ui.showInfoPopup("[ERROR] Error when placing displays, is your animation too large?", 5, 1, 1, 1, 1, 1)
                }
            } else {
                Log.infoTag("v2logic","[ERROR] Invalid block type... skipping")
                Vars.ui.showInfoPopup("[ERROR] Invalid block type... skipping", 1, 1, 1, 1, 1, 1)
            }
        })

        //    Max lines per processor
        const maxLines = 1000

        //    Debug mode: logs text mlog output to mlogs.txt
        const debugMode = config.debugMode

        //    Position of the first graphics processor
        let startingPoint = Vec2(startingPosition.x, startingPosition.y)

        //    Draw flush very x number of draw calls scaled by the rough amount of draw calls per frame. Set low for minimum crust, set high to lower space requirements
        let drawBufferFactor = compression

        //    Maximum number of pixels of the same colour drawn without calling "draw color". Set low for minimum crust, set high to lower space requirements drastically
        let maxColour = compression

        //    Min and max positions of the control panel, to prevent processors overwriting it
        let panelMin = Vec2(-2, -2)
        let panelMax = Vec2(3, 7)

        panelMin.x -= (displayAmount.x - 1) * 6
        panelMin.y -= (displayAmount.y - 1) * 6

        //    Define stuff
        let currProcessor = 0
        let processorFrame = 0
        let globalFrame = 1
        let lines = 0
        let currDrawCalls = 0
        let processorCode = ""

        let offset = Vec2(0, 0)
        let spiralIteration = 0
        let prevOffsetX = 0
        let prevOffsetY = 0

        let maxOffset = Vec2(0, 0)
        let minOffset = Vec2(0, 0)

        //        BEGIN PROCESSING
        
        if (header.compressed == 1) {

            processorCode = ""

            let displayName2
            let spiralOffset = 0

            for (let i = 0; i < totalBatches; i++) {
                let currBatch = animation[i]
                let currSeq = currBatch.seq
                let currBatchSize = currBatch.batchSize
                
                let frameProcessorBatchNumber = 0

                let alreadyFlushedPrevious = false

                for (let frame = 0; frame < currBatchSize; frame++) {
                    let currFrame = currSeq[frame]
                    let currFrameLength = currFrame.length

                    frameProcessorBatchNumber = 0

                    /*if (currFrameLength <= 0) {
                        continue
                    }*/

                    let drawBuffer = drawBufferFactor / (currFrameLength / maxLines)

                    //    Define frame header
                    if (globalFrame != 1) {

                        if (alreadyFlushedPrevious == false) {
                            processorCode += "drawflush " + displayName2 + "\n"
                        }

                        processorCode += mlogCodes.frameStart.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                             .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                             .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                             .replace(/_FINISHEDLABEL_/g, "FINISH" + processorFrame)
                                                             .replace(/_LOCK1LABEL_/g, "LOCK1" + processorFrame)
                                                             .replace(/_FRAME_/g, globalFrame) + "\n"
                    lines += 26 + 1
                    } else {
                        //processorCode += "drawflush " + displayName + "\n"
                        processorCode += mlogCodes.frameHead.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                            .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                            .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                            .replace(/_LOCK1LABEL_/g, "LOCK1" + processorFrame)
                                                            .replace(/_FRAME_/g, globalFrame) + "\n"
                    lines += 20 + 1
                    }

                    let prevPixel = null
                    let prevColour = []
                    let prevDisplayName = null
                    let prevPixelDisplayPos = null
                    let currColCalls = 0
                    let isNewDisplay = false

                    function calculateProcessorLocation() {
                        spiralOffset = spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                        offset.x = spiralOffset.x
                        offset.y = spiralOffset.y

                        while (dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorType.range ||
                               dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorType.range ||

                               ((startingPoint.x + offset.x > startingPosition.x + panelMin.y - Math.ceil(processorType.size / 2) && startingPoint.x + offset.x < startingPosition.x + panelMax.x + Math.ceil(processorType.size / 2)) &&
                                (startingPoint.y + offset.y > startingPosition.y + panelMin.y - Math.ceil(processorType.size / 2) && startingPoint.y + offset.y < startingPosition.y + panelMax.y + Math.ceil(processorType.size / 2))) ||

                               (offset.x == prevOffsetX && offset.y == prevOffsetY)
                               ) {

                            spiralOffset = spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                            offset.x = spiralOffset.x
                            offset.y = spiralOffset.y
                            spiralIteration += 1

                            if ((offset.x + processorType.size > processorType.range * 4) &&
                                (offset.y + processorType.size > processorType.range * 4)) {

                                Log.infoTag("v2logic","[ERROR] Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)
                                Vars.ui.showInfoPopup("[ERROR] Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames, 1, 1, 1, 1, 1, 1)

                                //    Place clock processor
                                placeProcessor(startingPosition.x + 1, startingPosition.y + 5, processorType.block, mlogCodes.clock
                                    .replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks)

                                //    Set max size of the processor array
                                if (offset.x > maxOffset.x) {
                                    maxOffset.x = offset.x
                                }

                                if (offset.y > maxOffset.y) {
                                    maxOffset.y = offset.y
                                }

                                if (offset.x < minOffset.x) {
                                    minOffset.x = offset.x
                                }

                                if (offset.y < minOffset.y) {
                                    minOffset.y = offset.y
                                }
                                
                                return {end: true}
                            }
                        }

                        return {end: false}
                    }

                    //    For creating large pixels for better compression
                    let pixelSizeMultiplier = new Vec2(1, 1)

                    for (let p = 0; p < currFrameLength; p++) {
                        let currPixel = currFrame[p]
                        let colour = currPixel[0]
                        let pixelPos = Vec2(currPixel[1] * scale, currPixel[2] * scale)
                        let pixSize = 1 * scale

                        let pixelDisplayPos = defineDisplayPositionAndOffset(pixelPos.x, pixelPos.y, displaySize)
                        let displayName = displayIDArray[pixelDisplayPos.displayOffset.y][pixelDisplayPos.displayOffset.x]

                        displayName2 = displayName


                        //    Define colour
                        let rgb = []
                        if (!isRaw) {
                            rgb = palette[colour]
                        } else {
                            rgb = colour
                        }

                        //    Find display edge pixels
                        let isWithinImageBorder = {x0: pixelPos.x <= scale * 2,
                            y0: pixelPos.y <= scale * 2,
                            x1: pixelPos.x >= size.x * scale - scale * 2,
                            y1: pixelPos.y >= size.y * scale - scale * 2}

                        //    Find display edge pixels
                        let isWithinBorder = {x0: pixelDisplayPos.x <= scale,
                            y0: pixelDisplayPos.y <= scale,
                            x1: pixelDisplayPos.x >= displaySize - scale, 
                            y1: pixelDisplayPos.y >= displaySize - scale}

                        //    Draw current pixel on the next display. Commented out because it creates a lot of crust for some reason
                        /*
                        if (pixelDisplayPos.x >= displaySize - scale || pixelDisplayPos.y >= displaySize - scale) {
                            let nextDisplay = displayIDArray[pixelDisplayPos.displayOffset.y + (isWithinBorder.y1 ? 1 : 0)]
                                                            [pixelDisplayPos.displayOffset.x + (isWithinBorder.x1 ? 1 : 0)]

                            processorCode += "drawflush " + displayName + "\n"
                            alreadyFlushed = true
                            
                            processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
                            processorCode += "draw rect " + ((isWithinBorder.x1) ? pixelDisplayPos.x - displaySize : pixelDisplayPos.x) + " "
                                                          + ((isWithinBorder.y1) ? pixelDisplayPos.y - displaySize : pixelDisplayPos.y) + " " + pixSize + " " + pixSize + "\n"
                            processorCode += "drawflush " + nextDisplay + "\n"

                            lines += 4

                        }
                        */

                        if (prevDisplayName == null) {
                            prevDisplayName = displayName
                        }


                        //    Skip if "draw color" if colour is the same or on a new display
                        if (((!(prevColour.toString() == colour.toString())) || lines == 3 || currColCalls >= maxColour) || (prevDisplayName != displayName)) {

                            if (alreadyFlushedPrevious == false && p > 0) {
                                processorCode += "drawflush " + prevDisplayName + "\n"
                            }

                            processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
                            currDrawCalls = 1
                            lines += 2
                            prevColour = colour
                            prevDisplayName = displayName
                            currColCalls = 1
                        } else {
                            currColCalls += 1
                        }

                        let pixelMultiplier = new Vec2(1, 1)

                        //print([pixelPos.x, pixelPos.y, size.x * scale - scale, size.y * scale - scale, isWithinImageBorder.x1, isWithinImageBorder.y1])

                        if (isWithinImageBorder.x1) {
                            pixelMultiplier.x *= 4
                            //print("Image border x")  
                        }

                        if (isWithinImageBorder.y1) {
                            pixelMultiplier.y *= 4
                            //print("image border y")
                        }

                        //    --------------------------------Draw the pixel-----------------------------------
                        processorCode += "draw rect " + (pixelDisplayPos.x  - (isWithinBorder.x0 ? scale : 0)) + " " + (pixelDisplayPos.y - (isWithinBorder.y0 ? scale : 0)) + " " + ((isWithinBorder.x1 || isWithinBorder.x0 ? pixSize * 2 : pixSize) * pixelMultiplier.x) + " " + ((isWithinBorder.y1 || isWithinBorder.y0 ? pixSize * 2 : pixSize) * pixelMultiplier.y) + "\n"
                        currDrawCalls += 1
                        lines += 1
                        //    ---------------------------------------------------------------------------------

                        //    Flush for new display

                        let alreadyFlushed = false
                            alreadyFlushedPrevious = false
                        
                        if ((prevDisplayName != displayName) && alreadyFlushed == false) {
                            currDrawCalls = 0
                            //processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
                            processorCode += "drawflush " + displayName + "\n"
                            processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
                            prevDisplayName = displayName
                            lines += 2
                            currColCalls += 1
                            alreadyFlushed = true
                        }
                        

                        //    Draw flush
                        if ((currDrawCalls + 1 > drawBuffer) && alreadyFlushed == false) {
                            currDrawCalls = 0
                            processorCode += "drawflush " + displayName + "\n"
                            lines += 1
                            alreadyFlushed = true
                            alreadyFlushedPrevious = true
                        }

                        //    Flush mlog to processor
                        if (lines + 6 + 27 /*extra room for error*/ > maxLines) {
                            currProcessor += 1
                            lines = 0
                            currDrawCalls = 0
                            frameProcessorBatchNumber += 1
                            if (alreadyFlushed == false) {
                                processorCode += "drawflush " + displayName + "\n"
                                alreadyFlushedPrevious = true
                            }
                            processorCode += "read frame cell1 0" + "\n"
                            processorCode += "jump _NEXTLABEL_ notEqual frame _FRAME_".replace("_FRAME_", globalFrame)
                                                                                      .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1)) + "\n"
                            processorCode += "write " + frameProcessorBatchNumber + " cell1 1" + "\n"
                            
                            
                            //    Define processor location
                            let thingy = calculateProcessorLocation()

                            if (thingy.end == true){
                                return
                            }

                            prevOffsetX = offset.x
                            prevOffsetY = offset.y

                            //    Place processor
                            processorCode = processorCode.replace(new RegExp("LABEL" + (processorFrame + 1), "g"), "LABEL0")
                            placeProcessor(startingPoint.x + Math.floor(offset.x), startingPoint.y + Math.floor(offset.y), processorType.block, processorCode, mainLinks) //mark
                            if (processorTypeStr == "hyperProcessor") {
                                placeCryo(Vec2(startingPoint.x + offset.x, startingPoint.y + offset.y))
                            }

                            //    Log mlog to logs.txt
                            if (debugMode) {
                                let prevDebug = Vars.tree.get("logs/mlogs.txt").readString() + "\n"
                                Vars.tree.get("logs/mlogs.txt").writeString(prevDebug + "CURRPROCESSOR " + currProcessor + " " + lines + " " + globalFrame + "\n" + processorCode)
                            }
                            
                            //    Reset mlog
                            processorFrame = 0
                            processorCode = ""

                            processorCode += mlogCodes.frameWithin.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                                  .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                                  .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                                  .replace(/_LOCK1LABEL_/g, "LOCK1" + processorFrame)
                                                                  .replace(/_FRAME_/g, globalFrame) + "\n"
                            processorCode += "write " + frameProcessorBatchNumber + " cell1 1" + "\n"
                            //processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
            
                            lines += 20 + 2
                            offset.y += 3
                        }

                    }
                    globalFrame += 1
                    processorFrame += 1
                }

                if (i == totalBatches - 1) {

                    //    Calculate final processor location
                    let thingy = calculateProcessorLocation()

                    if (thingy.end == true){
                        return
                    }
                    
                    //    Add final frame thingy
                    processorCode += mlogCodes.tail
                    processorCode = processorCode.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                 .replace(/_FINISHEDLABEL_/g, "FINISH" + processorFrame)
                                                 .replace(new RegExp("LABEL" + processorFrame, "g"), "LABEL0") + "\n"

                    //    Flush processor output
                    if (debugMode) {
                        let prevDebug = Vars.tree.get("logs/mlogs.txt").readString() + "\n"
                        Vars.tree.get("logs/mlogs.txt").writeString(prevDebug + "CURRPROCESSOR " + currProcessor + " " + lines + " " + globalFrame + "\n" + processorCode)
                    }

                    //    Place final processor
                    placeProcessor(startingPoint.x + offset.x, startingPoint.y + offset.y, processorType.block, processorCode, mainLinks) //mark
                    if (processorTypeStr == "hyperProcessor") {
                        placeCryo(Vec2(startingPoint.x + offset.x, startingPoint.y + offset.y))
                    }

                    //    Place clock processor
                    placeProcessor(startingPosition.x + 1, startingPosition.y + 5, processorType.block, mlogCodes.clock
                        .replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks)
                    
                }
            }
        }
    } catch (error) {
        Log.infoTag("v2logic",error.stack)
        Log.infoTag("v2logic",error);
    }
}

module.exports = {
render: render,
addToQueue: addToQueue,
defineAnimation: defineAnimation}

