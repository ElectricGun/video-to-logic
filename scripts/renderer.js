/*TODO:
    Fix crusty:

        -Dont draw single frames in parallel to reduce crust                                    DONE
        -Draw a frame only twice or a few times to prevent omega level crusting                 DONE
        -Lock write to cell 0 in frame clock when a draw job is active.                         DONE
            -Stop drawing if lock == 1
            -Only reset lock in clock

            This slows down the animation to sync with graphics processors to reduce crust. Maybe not a good thing
            
        Theres still a bit of crust on keyframes

    Add option for world procs

    Optimise if i have to

    Clean up code
        -Use a tilemap instead of hardcoding positions of the control panel
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

function addToQueue(name, compression, messageBlock) {
    let x = messageBlock.x / 8
    let y = messageBlock.y / 8
    let data = [name, Vec2(x, y), compression]
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

/*
function midpoint(x0, y0, x1, y1) {
    let midX = (x0 + x1) / 2
    let midY = (y0 + y1) / 2
    return Vec2(midX, midY)
}

function listCompare(list0, list1) {
    let length0 = list0.length
    let length1 = list1.length

    if (length0 != length1) {
        return false
    }

    for (let i = 0; i < length0; i++) {
        let same = list0[i] == list1[i]
        if (same == false) {
            return false
        }
    }
    return true
}
*/

function render () {

    let animationInfo = queue[0]
    let startTime = Time.millis()
    let startingPosition, frame, data, displayName, compression

    try {
        startingPosition = animationInfo[1]
        compression = animationInfo[2]
        displayName = (startingPosition.x * Vars.world.height() + startingPosition.y).toString(16).slice(2)
    } catch (error) {
        //do nothing if there is nothing in queue
        return
    }

    //if (activeAnimations[0] != null) {return}

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
        print("[ERROR] Invalid file location?")
        queue.splice(0, 1)
    }
    queue.splice(0, 1)

    try {
        //let nFrames = 0, second = 0, currFrame = 0
        startTime = Time.millis()
        
        let totalFrames = 0

        for (let i = 0; i < totalBatches; i++) {
            totalFrames += animation[i].batchSize
        };

        print(animation[0].seq[0].slice(-1)[0].slice(-1))
        //let frameLength = animation[0].seq[0].slice(-1)[0][1]
        //let frameHeight = animation[0].seq[0].slice(-1)[0][2]

        Vars.tree.get("logs/mlogs.txt").writeString(" ")
    
        let step = animation[0].step
        //    Place initial blocks
        placeBlock(startingPosition.x, startingPosition.y, Blocks.largeLogicDisplay)
        placeBlock(startingPosition.x - 2, startingPosition.y + 4, Blocks.memoryCell)
        placeBlock(startingPosition.x - 1, startingPosition.y + 4, Blocks.switchBlock, false)
        placeBlock(startingPosition.x + 3, startingPosition.y + 4, Blocks.liquidSource, Liquids.cryofluid)
        let mainLinks = [new LogicBlock.LogicLink(startingPosition.x, startingPosition.y, "display1", true),
                         new LogicBlock.LogicLink(startingPosition.x - 2, startingPosition.y + 4, "cell1", true),
                         new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
                    ]

        //    Max lines per processor
        const maxLines = 1000

        //    Label of jumps in text mlog (currently unused)
        const frameLabel = "LABEL"

        //    Debug mode: logs text mlog output to mlogs.txt
        const debugMode = config.debugMode

        //    Radius of the processor
        let processorRange = 42

        //    Scale image by
        let scale = 4

        //    Position of the first graphics processor
        const startingPoint = Vec2(startingPosition.x - 84 - 1, startingPosition.y - 84 + 2)

        //    Draw flush very x number of draw calls scaled by the rough amount of draw calls per frame. Set low for minimum crust, set high to lower space requirements
        let drawBufferFactor = compression

        //    Maximum number of pixels of the same colour drawn without calling "draw color". Set low for minimum crust, set high to lower space requirements drastically
        let maxColour = compression

        //    Define stuff
        let currProcessor = 0
        let processorFrame = 0
        let globalFrame = 1
        let lines = 0
        let currDrawCalls = 0
        let processorCode = ""
        let offset = Vec2(0, 0)
        let column = 0
        let isOdd = false
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
                    lines += 21 + 1
                    } else {
                        processorCode += "drawflush display1" + "\n"
                        processorCode += mlogCodes.frameHead.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                            .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                            .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                            .replace(/_FRAME_/g, globalFrame) + "\n"
                    lines += 16 + 1
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
                        if (lines + 5 + 22 + /*extra leeway for error*/ 0 > maxLines) {
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
                            
                            while (dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorRange ||
                                   dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorRange ||
                                   (startingPoint.x + offset.x > startingPosition.x - 4 && startingPoint.x + offset.x < startingPosition.x + 6) &&
                                   (startingPoint.y + offset.y > startingPosition.y - 3 && startingPoint.y + offset.y < startingPosition.y + 7)
                                   ) {
                            
                                isOdd = column % 2 == 0
                                offset.y += 3

                                if (offset.y + 3 > processorRange * 4) {
                                    offset.y = 0
                                    offset.x += 4
                                    column += 1
                                    if (isOdd) {
                                        offset.x -= 1
                                    }
                                }

                                if (offset.x + 3 > processorRange * 4) {
                                    print("Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)
                                    return
                                }
                            }
                            
                            //    Place processor
                            let cryoOffset = isOdd ? -2: 2
                            processorCode = processorCode.replace(new RegExp("LABEL" + (processorFrame + 1), "g"), "LABEL0")
                            placeBlock(startingPoint.x + offset.x + cryoOffset, startingPoint.y + offset.y, Blocks.liquidSource, Liquids.cryofluid)
                            placeProcessor(startingPoint.x + offset.x, startingPoint.y + offset.y, Blocks.hyperProcessor, processorCode, mainLinks.slice(0, 2))

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
            
                            lines += 16 + 2
                            offset.y += 3
                        }

                    }
                    globalFrame += 1
                    processorFrame += 1
                }

                if (i == totalBatches - 1) {

                    //    Place final processor

                    while (dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorRange ||
                            dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorRange ||
                            (startingPoint.x + offset.x > startingPosition.x - 4 && startingPoint.x + offset.x < startingPosition.x + 6) &&
                            (startingPoint.y + offset.y > startingPosition.y - 3 && startingPoint.y + offset.y < startingPosition.y + 7)
                            ) {
                    
                        isOdd = column % 2 == 0
                        offset.y += 3

                        if (offset.y + 3 > processorRange * 4) {
                            offset.y = 0
                            offset.x += 4
                            column += 1
                            if (isOdd) {
                                offset.x -= 1
                            }
                        }

                        if (offset.x + 3 > processorRange * 4) {
                            print("Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)
                            return
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

                    placeBlock(startingPoint.x + offset.x + 2, startingPoint.y + offset.y, Blocks.liquidSource, Liquids.cryofluid)
                    placeProcessor(startingPoint.x + offset.x, startingPoint.y + offset.y, Blocks.hyperProcessor, processorCode, mainLinks.slice(0, 2))

                    //    Place clock processor
                    placeProcessor(startingPosition.x + 1, startingPosition.y + 5, Blocks.hyperProcessor, mlogCodes.clock
                    .replace(/_PERIOD_/g, (1 / animation[0].fps * step) * 1000)
                    .replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks)
                }
            }
        }
    } catch (error) {
        print(error.stack)
        print(error);
    }
}


/*
function countdown (seconds) {

    for (let i = 0; i < seconds; i++) {
        let counter = i
        Packages.arc.util.Time.run(60 * i, () => {print(counter + 1)})
    }
}
*/

module.exports = {
render: render,
addToQueue: addToQueue,
defineAnimation: defineAnimation}

