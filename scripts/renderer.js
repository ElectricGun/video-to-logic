/*TODO:
    Fix crusty:

        -Dont draw single frames in parallel to reduce crust.                                    DONE
        -Draw a frame only twice or a few times to prevent omega level crusting.                 DONE
        -Lock write to cell 0 in frame clock when a draw job is active.                          DONE
            -Stop drawing if lock == 1
            -Only reset lock in clock

            This slows down the animation to sync with graphics processors to reduce crust. Maybe not a good thing.
            
        Theres still a bit of crust on keyframes when the ipt is above 750 or so. This is probably something to do with the nature of the game.

    Add option for other processors.                                                             DONE

    Set ipt of World processors to 25 when switch is disabled to reduce lag

    Add programmable settings, like ipt and refreshes per cycle.                                 DONE

    Optimise if i have to.

    Clean up code.

    Framebuffer:
        -Instead of drawing straight into the display, write packed pixel values into membanks and have dedicated gpus to draw them.
        This will probably speed up render time at the cost of being more spacious.
        -Let this be toggleable.
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
        print(e)
    }
    return {animation: animation, header: header, totalBatches: totalBatches}
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

function render () {    //what the hell is this function

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

    //if (activeAnimations[0] != null) {return}

    if (compression < 0) {
        print("[ERROR] Argument compression must be greater than 0")
        return
    }

    activeAnimations.splice(-1, 0, displayName)
    let animationData, animation, header, totalBatches, isRaw
    try {
        animationData = defineAnimation(animationInfo[0])
        animation = animationData.animation
        header = animationData.header
        totalBatches = animationData.totalBatches
        let compressionType = header.compressed
        isRaw = header.isRaw
    } catch(e) {
        print("[ERROR] Invalid file location?")
        queue.splice(0, 1)
    }
    queue.splice(0, 1)

    try {

        startTime = Time.millis()
        
        let totalFrames = 0

        for (let i = 0; i < totalBatches; i++) {
            totalFrames += animation[i].batchSize
        };

        print(animation[0].seq[0].slice(-1)[0].slice(-1))

        Vars.tree.get("logs/mlogs.txt").writeString(" ")
    
        let step = animation[0].step


        const mainLinks = [
            new LogicBlock.LogicLink(startingPosition.x, startingPosition.y, "display1", true),
            new LogicBlock.LogicLink(startingPosition.x - 2, startingPosition.y + 4, "cell1", true),
            new LogicBlock.LogicLink(startingPosition.x + 3, startingPosition.y + 5, "cell2", true),
            new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
        ]

        const configLinks = [
            new LogicBlock.LogicLink(startingPosition.x + 3, startingPosition.y + 5, "cell1", true),
            new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
        ]

        let startingTiles = [
            {type: "block", x: startingPosition.x,     y: startingPosition.y,     block: Blocks.largeLogicDisplay, config: undefined},
            {type: "block", x: startingPosition.x - 2, y: startingPosition.y + 4, block: Blocks.memoryCell,        config: undefined},
            {type: "block", x: startingPosition.x - 1, y: startingPosition.y + 4, block: Blocks.switchBlock,       config: false},
            {type: "block", x: startingPosition.x + 3, y: startingPosition.y + 4, block: Blocks.liquidSource,      config: Liquids.cryofluid},
            {type: "block", x: startingPosition.x + 3, y: startingPosition.y + 5, block: Blocks.memoryCell,        config: undefined},
            {type: "processor", x: startingPosition.x + 3, y: startingPosition.y + 6,         block: Blocks.microProcessor, code: mlogCodes.config.replace(/_FPS_/g, animation[0].fps / step), 
                links: configLinks}
            
        ]
        /* WIP
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

        let processorTypes = {
            microProcessor: {block: Blocks.microProcessor, size: 1, squishX: 0, squishY: 0, range: 10},
            logicProcessor: {block: Blocks.logicProcessor, size: 2, squishX: 0, squishY: 0, range: 22},
            hyperProcessor: {block: Blocks.hyperProcessor, size: 4, squishX: 0.5, squishY: 1, range: 42},
            worldProcessor: {block: Blocks.worldProcessor, size: 1, squishX: 0, squishY: 0, range: 10000}
        }

        let processorType
        try{
            processorType = processorTypes[processorTypeStr]
        } catch (e) {
            print("[ERROR] Invalid processor type argument")
            return
        }

        //    Place initial blocks
        startingTiles.forEach(b => {
            if (b.type == "block") {
                placeBlock(b.x, b.y, b.block, b.config)
            } else if(b.type == "processor") {
                placeProcessor(b.x, b.y, b.block, b.code, b.links)
            } else {
                print("[ERROR] Invalid block type... skipping")
            }
        })

        //    Max lines per processor
        const maxLines = 1000

        //    Label of jumps in text mlog (currently unused)
        const frameLabel = "LABEL"

        //    Debug mode: logs text mlog output to mlogs.txt
        const debugMode = config.debugMode

        //    Radius of the processor
        let processorRange = 42

        //    Scale image by
        //let scale = 4

        //    Position of the first graphics processor
        //let startingPoint = Vec2(startingPosition.x - 84 - 1, startingPosition.y - 84 + 2)
        let startingPoint = Vec2(startingPosition.x, startingPosition.y)

        //    Draw flush very x number of draw calls scaled by the rough amount of draw calls per frame. Set low for minimum crust, set high to lower space requirements
        let drawBufferFactor = compression

        //    Maximum number of pixels of the same colour drawn without calling "draw color". Set low for minimum crust, set high to lower space requirements drastically
        let maxColour = compression

        let panelMin = Vec2(3, 3)
        let panelMax = Vec2(3, 6)

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
        if (header.compressed == 1) {

            processorCode = ""

            for (let i = 0; i < totalBatches; i++) {
                let currBatch = animation[i]
                let currSeq = currBatch.seq
                let currBatchSize = currBatch.batchSize
                
                let frameProcessorBatchNumber = 0

                for (let frame = 0; frame < currBatchSize; frame++) {
                    let currFrame = currSeq[frame]
                    let currFrameLength = currFrame.length

                    frameProcessorBatchNumber = 0

                    if (currFrameLength <= 0) {
                        continue
                    }

                    let drawBuffer = drawBufferFactor / (currFrameLength / maxLines)

                    //    Define frame header
                    if (globalFrame != 1) {
                        processorCode += "drawflush display1" + "\n"
                        processorCode += mlogCodes.frameStart.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                             .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                             .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                             .replace(/_FINISHEDLABEL_/g, "FINISH" + processorFrame)
                                                             .replace(/_FRAME_/g, globalFrame) + "\n"
                    lines += 26 + 1
                    } else {
                        processorCode += "drawflush display1" + "\n"
                        processorCode += mlogCodes.frameHead.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                            .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                            .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                            .replace(/_FRAME_/g, globalFrame) + "\n"
                    lines += 20 + 1
                    }

                    let prevColour = []
                    let currColCalls = 0
                    for (let p = 0; p < currFrameLength; p++) {
                        let currPixel = currFrame[p]
                        let colour = currPixel[0]
                        let pixelPos = Vec2(currPixel[1], currPixel[2])
                        let pixSize = 1 * scale

                        //    Define pixel

                        let rgb = []
                        if (!isRaw) {
                            rgb = palette[colour]
                        } else {
                            rgb = colour
                        }

                        if ((!(prevColour.toString() == colour.toString())) || lines == 3 || currColCalls >= maxColour) {
                            processorCode += "drawflush display1" + "\n"
                            processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
                            currDrawCalls = 1
                            lines += 2
                            prevColour = colour
                            currColCalls = 0
                        } else {
                            currColCalls += 1
                        }
                        processorCode += "draw rect " + pixelPos.x * scale + " " + pixelPos.y * scale + " " + pixSize + " " + pixSize + "\n"
                        currDrawCalls += 1
                        lines += 1

                        //    Draw flush
                        if (currDrawCalls + 1 > drawBuffer) {
                            currDrawCalls = 0
                            processorCode += "drawflush display1" + "\n"
                            lines += 1
                        }

                        //    Flush mlog to processor
                        if (lines + 6 + 27 + /*extra leeway for error*/ 3 > maxLines) {
                            currProcessor += 1
                            lines = 0
                            currDrawCalls = 0
                            frameProcessorBatchNumber += 1
                            processorCode += "drawflush display1" + "\n"
                            processorCode += "read frame cell1 0" + "\n"
                            processorCode += "jump _NEXTLABEL_ notEqual frame _FRAME_".replace("_FRAME_", globalFrame)
                                                                                      .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1)) + "\n"
                            processorCode += "write " + frameProcessorBatchNumber + " cell1 1" + "\n"
                            
                            
                            //    Define processor location

                            let spiralOffset = spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                            offset.x = spiralOffset.x
                            offset.y = spiralOffset.y

                            while (dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorType.range ||
                                   dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorType.range ||

                                   ((startingPoint.x + offset.x > startingPosition.x - panelMin.y - processorType.size / 2 && startingPoint.x + offset.x < startingPosition.x + panelMax.x + processorType.size / 2) &&
                                    (startingPoint.y + offset.y > startingPosition.y - panelMin.y - processorType.size / 2 && startingPoint.y + offset.y < startingPosition.y + panelMax.y + processorType.size / 2)) ||

                                   (offset.x == prevOffsetX && offset.y == prevOffsetY)
                                   ) {

                                spiralOffset = spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                                offset.x = spiralOffset.x
                                offset.y = spiralOffset.y
                                spiralIteration += 1

                                if ((offset.x + processorType.size > processorType.range * 4) &&
                                    (offset.y + processorType.size > processorType.range * 4)) {

                                    print("Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)

                                    //    Place clock processor
                                    placeProcessor(startingPosition.x + 1, startingPosition.y + 5, Blocks.hyperProcessor, mlogCodes.clock
                                        //.replace(/_PERIOD_/g, (1 / animation[0].fps * step) * 1000)
                                        .replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks)
                                    return
                                }
                            }

                            print([spiralIteration, offset.x, offset.y, spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY).y])

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

                            prevOffsetX = offset.x
                            prevOffsetY = offset.y

                            //    Place processor
                            processorCode = processorCode.replace(new RegExp("LABEL" + (processorFrame + 1), "g"), "LABEL0")
                            placeProcessor(startingPoint.x + Math.floor(offset.x), startingPoint.y + Math.floor(offset.y), processorType.block, processorCode, mainLinks.slice(0, 3))


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
                                                                  .replace(/_FRAME_/g, globalFrame) + "\n"
                            processorCode += "write " + frameProcessorBatchNumber + " cell1 1" + "\n"
                            processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
            
                            lines += 20 + 2
                            offset.y += 3
                        }

                    }
                    globalFrame += 1
                    processorFrame += 1
                }

                if (i == totalBatches - 1) {

                    //    Place final processor (lazy copy and paste i know)

                    let spiralOffset = spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                    offset.x = spiralOffset.x
                    offset.y = spiralOffset.y
                    while (dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorType.range ||
                    dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorType.range ||

                    ((startingPoint.x + offset.x > startingPosition.x - panelMin.y - processorType.size / 2 && startingPoint.x + offset.x < startingPosition.x + panelMax.x + processorType.size / 2) &&
                     (startingPoint.y + offset.y > startingPosition.y - panelMin.y - processorType.size / 2 && startingPoint.y + offset.y < startingPosition.y + panelMax.y + processorType.size / 2)) ||

                    (offset.x == prevOffsetX && offset.y == prevOffsetY)
                    ) {

                        spiralOffset = spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                        offset.x = spiralOffset.x
                        offset.y = spiralOffset.y
                        spiralIteration += 1

                        if ((offset.x + processorType.size > processorType.range * 4) &&
                            (offset.y + processorType.size > processorType.range * 4)) {

                            //    Place clock processor
                            placeProcessor(startingPosition.x + 1, startingPosition.y + 5, Blocks.hyperProcessor, mlogCodes.clock
                                //.replace(/_PERIOD_/g, (1 / animation[0].fps * step) * 1000)
                                .replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks)
                            print("Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)
                            return
                        }
                    }

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

                    //    Place Cryofluid sources
                    let cryoPos = Vec2(minOffset.x -2, minOffset.y)
                    if (processorTypeStr == "hyperProcessor") {
                        while (true) {
                            if (!((startingPoint.x + cryoPos.x > startingPosition.x - panelMin.y &&
                                startingPoint.x + cryoPos.x < startingPosition.x + panelMax.x) &&
                                (startingPoint.y + cryoPos.y > startingPosition.y - panelMin.y &&
                                startingPoint.y + cryoPos.y < startingPosition.y + panelMax.y))) {
                                placeBlock(startingPosition.x + cryoPos.x, startingPosition.y + cryoPos.y, Blocks.liquidSource, Liquids.cryofluid)
                            }
                            cryoPos.y += 3
                            if (cryoPos.y > maxOffset.y) {
                                cryoPos.x += 7
                                cryoPos.y = minOffset.y
                            }
                            if (cryoPos.x > maxOffset.x + 2) {
                                break
                            }
                        }
                    }
                    
                    processorCode += mlogCodes.tail
                    processorCode = processorCode.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                 .replace(/_FINISHEDLABEL_/g, "FINISH" + processorFrame)
                                                 .replace(new RegExp("LABEL" + processorFrame, "g"), "LABEL0") + "\n"

                    if (debugMode) {
                        let prevDebug = Vars.tree.get("logs/mlogs.txt").readString() + "\n"
                        Vars.tree.get("logs/mlogs.txt").writeString(prevDebug + "CURRPROCESSOR " + currProcessor + " " + lines + " " + globalFrame + "\n" + processorCode)
                    }

                    placeProcessor(startingPoint.x + offset.x, startingPoint.y + offset.y, processorType.block, processorCode, mainLinks.slice(0, 3))

                    //    Place clock processor
                    placeProcessor(startingPosition.x + 1, startingPosition.y + 5, Blocks.hyperProcessor, mlogCodes.clock
                        //.replace(/_PERIOD_/g, (1 / animation[0].fps * step) * 1000)
                        .replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks)
                    
                }
            }
        }
    } catch (error) {
        print(error.stack)
        print(error);
    }
}

module.exports = {
render: render,
addToQueue: addToQueue,
defineAnimation: defineAnimation}

