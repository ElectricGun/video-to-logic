/*TODO:
    fix crusty and save space problem:
        - solutions: 
                    Dont draw single frames in parallel               DONE

                            In code:
                                Add 1 to batch number every time placeProcessor() is called
                                Reset on next frame iteration
                                Add extra jump notEqual batch number LABELn + 1

                            In processor:
                                Use (cell1 1) space to store batch number. 
                                Every batch, add +1 to the current batch number.
                                Dont draw if batch does not sync.

                        Batch number is not frame number
                    Draw frames only a definite amount of times


                    Jump back away from set batch number if frame is not synced to avoid issues
*/
const mlogCodes = require("mlogs")

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
    let totalBatches, data
    let header = JSON.parse(Vars.tree.get("animations/" + name + "/" + "frame" + "config.json").readString())
    try {
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

function addToQueue(name, displayName, messageBlock) {
    let x = messageBlock.x / 8
    let y = messageBlock.y / 8
    let data = [name, Vec2(x, y), displayName]
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

    //let prevDebug = Vars.tree.get("logs/logs.txt").readString() + "\n"
    //Vars.tree.get("logs/logs.txt").writeString(prevDebug + "(" + x + ", " + y + ") " + "\n" + code)

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
  
function render () {

    let animationInfo = queue[0]
    let startTime = Time.millis()
    let startingPosition, frame, data, displayName

    try {
        if (animationInfo[2] == null) {
            displayName = animationInfo[0]
        } else {
            displayName = animationInfo[2]
        }
        startingPosition = animationInfo[1]

    } catch (error) {
        //do nothing if there is nothing in queue
        return
    }

    let id  = mulberry32(startingPosition.x + startingPosition.y * startingPosition.x).toString(16).slice(2)
    
    //if (activeAnimations[0] != null) {return}    //remove this line for insanity

    activeAnimations.splice(-1, 0, id)

    let animationData = defineAnimation(animationInfo[0])
    let animation = animationData.animation
    let header = animationData.header
    let totalBatches = animationData.totalBatches
    let compressionType = header.compressed
    let isRaw = header.isRaw
    queue.splice(0, 1)
    /*
    if (!isRaw) {
        print("[V2Logic Sequencing]: Sequence must be raw colours.")
        return
    }*/

    try {
        let nFrames = 0, second = 0, currFrame = 0
        startTime = Time.millis()
        
        let totalFrames = 0

        for (let i = 0; i < totalBatches; i++) {
            totalFrames += animation[i].batchSize
        };

        print(animation[0].seq[0].slice(-1)[0].slice(-1))
        let frameLength = animation[0].seq[0].slice(-1)[0][1]
        let frameHeight = animation[0].seq[0].slice(-1)[0][2]

        Vars.tree.get("logs/logs.txt").writeString(" ")
    
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
        placeProcessor(startingPosition.x + 1, startingPosition.y + 5, Blocks.hyperProcessor, mlogCodes.clock.replace("_PERIOD_", (1 / animation[0].fps * step) * 1000)
                                                                                                             .replace("_MAXFRAME_", totalFrames), mainLinks)

        const maxLines = 1000
        const startingPoint = Vec2(startingPosition.x - 84 - 1, startingPosition.y - 84 + 2) //    Starting position of draw processer
        const frameLabel = "LABEL"
        const debugMode = false
        const processorRange = 42
        const scale = 4

        let drawBuffer = 10
        let currProcessor = 0
        let processorFrame = 0
        let globalFrame = 1
        let lines = 0
        let currDrawCalls = 0
        let processorCode = ""
        let offset = Vec2(0, 0)
        let isOdd = false
        let column = 0

        let startProcessorFrame = 0

        //    Higher = smaller size but more crust
        const drawBufferFactor = 25 //    Max = 1024. Recommended 10 to 20 depending on the length of animation animation; longer animation = higher value
        const maxColour = 25 //    Don't go above 2 or 3, too much crust due to draw flushing. 0 = minimum crust
        
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

                    drawBuffer = drawBufferFactor / (currFrameLength / maxLines)

                    //    Define frame header
                    if (frame != 0) {
                        processorCode += "drawflush display1" + "\n"
                        processorCode += mlogCodes.frameStart.replace("_PREVLABEL_", "LABEL" + processorFrame + ":")
                                                        .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                        .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                        .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                        .replace("_BATCH_", frameProcessorBatchNumber)
                                                        .replace("_FRAME_", globalFrame) + "\n"
                    lines += 8
                    } else {
                        processorCode += "drawflush display1" + "\n"
                        processorCode += mlogCodes.frameHead.replace("_PREVLABEL_", "LABEL" + processorFrame + ":")
                                                        .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                        .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                        .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                        .replace("_BATCH_", frameProcessorBatchNumber)
                                                        .replace("_FRAME_", globalFrame) + "\n"
                    lines += 6
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

                        /*
                        if (currProcessor == 200) {
                            let prevDebug = Vars.tree.get("logs/logs.txt").readString() + "\n"
                            Vars.tree.get("logs/logs.txt").writeString(prevDebug + "pixel " + p + " lines " + lines + "\n" + processorCode)
                        }
                        */

                        //    Flush mlog to processor
                        if (lines + 17 > maxLines) {
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
                            processorCode = processorCode.replace("LABEL" + (processorFrame + 1), "LABEL0")
                                                         .replace("LABEL" + (processorFrame + 1), "LABEL0")
                                                         .replace("LABEL" + (processorFrame + 1), "LABEL0")
                                                         .replace("LABEL" + (processorFrame + 1), "LABEL0")
                            placeBlock(startingPoint.x + offset.x + cryoOffset, startingPoint.y + offset.y, Blocks.liquidSource, Liquids.cryofluid)
                            placeProcessor(startingPoint.x + offset.x, startingPoint.y + offset.y, Blocks.hyperProcessor, processorCode, mainLinks.slice(0, 2))

                            //    Log mlog to logs.txt
                            
                            if (debugMode) {
                                let prevDebug = Vars.tree.get("logs/logs.txt").readString() + "\n"
                                Vars.tree.get("logs/logs.txt").writeString(prevDebug + "CURRPROCESSOR " + currProcessor + "\n" + processorCode)
                            }
                            

                            //    Reset mlog
                            processorFrame = 0
                            startProcessorFrame = processorFrame
                            processorCode = ""
                            
                            processorCode += mlogCodes.frameWithin.replace("_PREVLABEL_", "LABEL" + processorFrame + ":")
                                                            .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                            .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                            .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                                                            .replace("_BATCH_", frameProcessorBatchNumber)
                                                            .replace("_FRAME_", globalFrame) + "\n"
                                processorCode += "write " + frameProcessorBatchNumber + " cell1 1" + "\n"
                                processorCode += "draw color " + rgb[0] + " " + rgb[1] + " " + rgb[2] + " 255" + "\n"
                            
                            /*
                            processorCode += mlogCodes.frameHeader.replace("_PREVLABEL_", "LABEL" + processorFrame + ":")
                            .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                            .replace("_NEXTLABEL_", "LABEL" + (processorFrame + 1))
                            .replace("_FRAME_", globalFrame)
                            .replace("_BATCH_", frameProcessorBatchNumber) + "\n"
                            processorCode += "drawflush display1" + "\n"
                            */
                            lines += 8
                            offset.y += 3
                        }

                    }
                    globalFrame += 1
                    processorFrame += 1

                    //print(["processorFrame", processorFrame, "lines", lines, "currDrawCalls", currDrawCalls, "currProcessor", currProcessor])
                }

                if (i == totalBatches - 1) {

                    //    Place final processor
                    processorCode = processorCode.replace("LABEL" + (processorFrame), "LABEL0")
                    placeBlock(startingPoint.x + offset.x + 2, startingPoint.y + offset.y, Blocks.liquidSource, Liquids.cryofluid)
                    placeProcessor(startingPoint.x + offset.x, startingPoint.y + offset.y, Blocks.hyperProcessor, processorCode, mainLinks.slice(0, 2))
                }
            }
        }
    } catch (error) {
        print(error);
    }
}



function countdown (seconds) {

    for (let i = 0; i < seconds; i++) {
        let counter = i
        Packages.arc.util.Time.run(60 * i, () => {print(counter + 1)})
    }
}

module.exports = {
countdown: countdown,
render: render,
addToQueue: addToQueue,
defineAnimation: defineAnimation}

