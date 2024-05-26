/*
TODO:
    CURRENT: MAIN FUNCTION, ITS NOT GOOD, TOO MANY ARGS 
            - REWRITE RENDERER:
                ADD PROCESSORS PER FRAME ARGS:
                    instead of placing processors every cycle, create processor identities with undefined position values. place them afterwards using spiral

            - Clean up code.

        CURRENT: 
        Successfully generated mlog code for the cores [DONE]
                - Now i need to place the processor cores with the code [DONE]
             
            CURRENT: [DONE]
            Graphical processors successfully placed 
                - link the processors to a display and the necessary memcells {DONE}
                - debug if it actually works [DONE]
            
            CURRENT: Optimise the video, etc
                - pixel grouping, compression, etc
                - remove redundant draw colors and draw flushes [WIP]
                - add refreshesPerSecond functionality

ISSUES:

    CURRENT ISSUES:
        - The graphics processors are drawing even when the switch is turned off
        - Unoptimised
        - lots of crust on high ipt

    FIXED ISSUES:
        - The video is extremely buggy, the monkey is drawn and is visible on some frames but most of the time its just a mess. [FIXED, turns out i set the width and height to x + 1 and y + 1 respectively, oopsies]
        - Somethings up with how the frames are generated (last few frames arent being generated for some reason) [FIXED]
          Its probably due to the distribution 
          or maybe the last few cores arent being generated because the loop ends and the frames are still within threshold

*/


const functions = require("v2logic/functions")
const config = JSON.parse(Jval.read(Vars.tree.get("data/config.hjson").readString()))
const mlogCodes = require("v2logic/mlogs")
// const { markerPixelTrans } = require("./mlogs") // what is this line?

const palette = [
    [217, 157, 115], [140, 127, 169], [235, 238, 245], [149, 171, 217], //copper,        lead,       metaglass,  graphite
    [247, 203, 164], [39, 39, 39], [141, 161, 227], [249, 163, 199],    //sand,          coal,       titanium,   thorium
    [119, 119, 119], [83, 86, 92], [203, 217, 127], [244, 186, 110],    //scrap,         silicon,    plastanium, phase
    [243, 233, 121], [116, 87, 206], [255, 121, 94], [255, 170, 95],    //surge,         spore,      blast,      pyratite
    [58, 143, 100], [118, 138, 154], [227, 255, 214], [137, 118, 154],  //beryllium,     tungsten,   oxide,      carbide
    [94, 152, 141], [223, 130, 77]                                      //fissileMatter, dormantCyst
]

var activeAnimations = []
var queue = []

function addToQueue(name, compression, scale, processorType, mode, messageBlock) {
    let x = messageBlock.x / 8
    let y = messageBlock.y / 8
    let data = [name, Vec2(x, y), compression, processorType, Math.floor(scale), mode]
    queue.push(data)
}

function loadAnimation (name) {
    let animation = []
    let totalBatches, data, header
    try {
    header = JSON.parse(Vars.tree.get("animations/" + name + "/" + "frame" + "config.json").readString())
        for (let i = 0;i < header.totalBatches; i++) {
            data = JSON.parse(Vars.tree.get("animations/" + name + "/" + "frame" + i + ".json").readString())
            animation.push(data)
        }
        totalBatches = header.totalBatches
    } catch (e) {
        Log.infoTag("v2logic", e)
    }
    return {animation: animation, header: header, totalBatches: totalBatches, name: name}
}

function createProcessorIdentity(position, type, code, links) {
    let identity = {
        positionX: position.x,
        positionY: position.y,
        type: type,
        links: links,
        code: code
    }
    return identity
}

function generateGraphicProcessors (commandInfo, animationData) {
    let processorIdentities = []
    // unhardcode processor
    let processorType = functions.getProcessorType("worldProcessor")
    let mainLinks = ""

    // load the animation

    let animation = animationData.animation
    let header = animationData.header
    let totalBatches = animationData.totalBatches

    //    Define animation size and number of displays

    let size = functions.defineFrameSize(animation[0].seq[0])
    const displaySize = 180
    //const offsetOneMult = new Vec2((size.x + 1) / size.x, (size.y + 1) / size.y)    //    Multiply pixels by this so that it fits the display
    //const displayAmount = new Vec2(Math.ceil((size.x * scale) / displaySize), Math.ceil((size.y * scale) / displaySize))

    // unhardcode cores
    let cores = 16

    const drawBufferSize = 255
    const maxInstructionsPerProcessor = 900
    
    let globalFrame = 0
    let currentProcessor = 0

    let coreData = {
        processorCode: [],
        processorFrame: [],
        lines: [],
        drawCalls: [],
        drawColourCalls: [],
        batchNumber: [],
        isAlreadyFlushed: [],
        startFrame: []
    }

    for (let i = 0; i < cores; i++) {
        coreData.processorCode[i] = ""
        coreData.processorFrame[i] = 0
        coreData.lines[i] = 0
        coreData.batchNumber[i] = 0
        coreData.drawCalls[i] = 0
        coreData.drawColourCalls[i] = 0
        coreData.isAlreadyFlushed[i] = false
        coreData.startFrame[i] = 0
    }

    let scale = commandInfo[4]

    function flushToProcessor(coreIndex) {
        if (!coreData.isAlreadyFlushed[coreIndex]) {
            // unhardcode name after multi display
            writeFlush("display1")
        }

        coreData.processorCode[coreIndex] += "\nread frame cell1 0" + "\n"
        coreData.processorCode[coreIndex] += "jump _NEXTLABEL_ notEqual frame _FRAME_".replace("_FRAME_", globalFrame)
                                                                                .replace("_NEXTLABEL_", "LABEL" + (coreData.processorFrame[coreIndex] + 1)) + "\n"
        coreData.processorCode[coreIndex] += "write " + coreData.batchNumber[coreIndex] + " cell1 1" + "\n"


        // replace the final jump LABEL# to LABEL0                                
        coreData.processorCode[coreIndex] = coreData.processorCode[coreIndex].replace(new RegExp("LABEL" + (coreData.processorFrame[coreIndex] + 1), "g"), "LABEL0")

        if (config.debugMode) {
            let prevDebug = Vars.tree.get("logs/mlogs.txt").readString() + "\n"
            Vars.tree.get("logs/mlogs.txt").writeString(prevDebug + 
                "\nCURRPROCESSOR " + currentProcessor + 
                " ProcessorType: " + processorType.block + 
                " Core: " + coreIndex + 
                " Lines: " + coreData.lines[coreIndex] + 
                " FrameCount: " + ((globalFrame - coreData.startFrame[coreIndex]) + 1) +
                " StartFrame: " + coreData.startFrame[coreIndex] +
                " EndFrame: " + globalFrame +
                " FinalProcessorFrame: " + coreData.processorFrame[coreIndex] + "\n"
                + "```{mlog}" 
                + coreData.processorCode[coreIndex]) // the mlog
                + "```"
        }

        processorIdentities.push(createProcessorIdentity(Vec2(0, 0),  processorType.block, coreData.processorCode[coreIndex], mainLinks))
        coreData.processorFrame[coreIndex] = 0
        coreData.lines[coreIndex] = 0
        coreData.processorCode[coreIndex] = "\n" + mlogCodes.frameHead
            .replace(/_PREVLABEL_/g, "LABEL" +      coreData.processorFrame[coreIndex])
            .replace(/_NEXTLABEL_/g, "LABEL" +     (coreData.processorFrame[coreIndex] + 1))
            .replace(/_BATCH_/g,                       coreData.batchNumber[coreIndex])
            .replace(/_FINISHEDLABEL_/g, "FINISH" + coreData.processorFrame[coreIndex])
            .replace(/_LOCK1LABEL_/g, "LOCK1" +     coreData.processorFrame[coreIndex])
            .replace(/_FRAME_/g, globalFrame) + "\n"

        currentProcessor += 1
        coreData.batchNumber[coreIndex] += 1
    }

    // for every batch
    for (let i = 0; i < totalBatches; i++) {
        let currentBatch = animation[i]
        
        // for every frame
        for (let f = 0; f < currentBatch.batchSize; f++) {

            let frameDrawCalls = 0;

            // reset batchnumbers
            for (let b = 0; b < cores; b++) {
                coreData.batchNumber[b] = 0
            }
        
            let currentFrame = currentBatch.seq[f]
            let pixelsPerCore = Math.floor(currentFrame.length / cores)

            print(globalFrame + " " + pixelsPerCore)

            let framePixelIndex = 0

            // for every core
            for (let c = 0; c < cores; c++) {

                function writeFlush(displayNameString) {
                    coreData.processorCode[c] +=  "drawflush " + displayNameString + "\n"
                    coreData.isAlreadyFlushed[c] = true
                    coreData.lines[c] += 1
                    coreData.drawCalls[c] = 0
                    frameDrawCalls = 0
                }

                let processorPixelCount = 0
                coreData.startFrame[c] = globalFrame

                let processorFrame = coreData.processorFrame[c]
                let frameProcessorBatchNumber = coreData.batchNumber[c]

                // ----------- create the header of each frame

                if (!coreData.isAlreadyFlushed[c]) {
                    // unhardcode name after multi display
                    writeFlush("display1")
                }

                coreData.processorCode[c] += "\n" + mlogCodes.frameHead.replace(/_PREVLABEL_/g, "LABEL" + coreData.processorFrame[c])
                .replace(/_NEXTLABEL_/g, "LABEL" + (coreData.processorFrame[c] + 1))
                .replace(/_BATCH_/g, coreData.batchNumber[c])
                .replace(/_FINISHEDLABEL_/g, "FINISH" + coreData.processorFrame[c])
                .replace(/_LOCK1LABEL_/g, "LOCK1" + coreData.processorFrame[c])
                .replace(/_FRAME_/g, globalFrame) + "\n"

                
                // unhardcode name after multi display
                writeFlush("display1")

                // unhardcode
                coreData.lines[c] += 27

                // ----------------------------------------------

                // for every pixel
                for (let p = framePixelIndex; p < (c != cores - 1 ? pixelsPerCore * (c + 1) : currentFrame.length); p++) {

                    let currentPixel = currentFrame[p]
                    let pixelColour = currentPixel[0]
                    let pixelPosition = Vec2(currentPixel[1], currentPixel[2])

                    //    Define colour
                    if (!header.isRaw) {
                        // dynamically typed shenanigans
                        pixelColour = palette[pixelColour]
                    }

                    // ---- draw the pixel -----------------------

                    
                    
                    coreData.isAlreadyFlushed[c] = false


                    coreData.processorCode[c] += "draw color " + pixelColour[0] + " " + pixelColour[1] + " " + pixelColour[2] + " 255" + "\n"
                                                    +  "draw rect " + (pixelPosition.x * scale) + " " + (pixelPosition.y * scale) + " " + (scale) + " " + (scale) + "\n"
                                                    
                                                    
                    // unhardcode
                    coreData.lines[c]  += 2
                    coreData.drawCalls[c] += 2
                    frameDrawCalls += 2

                    if (frameDrawCalls > (drawBufferSize / cores)) {
                        // unhardcode name after multi display
                        writeFlush("display1")
                        frameDrawCalls = 0
                    }


                    // for testing only ------------------------ #
                    
                    //coreData.processorCode[c] += "draw color " + pixelColour[0] + " " + pixelColour[1] + " " + pixelColour[2] + " 255" + "\n"
                    //coreData.lines[c] += 1

                    // print("Pixel:" + currentPixel + " Core: " + c + " Pixel Index: " + currentFrame.indexOf(currentPixel))

                    // ----------------------------------------- #
                    
                    framePixelIndex++
                    processorPixelCount++
                    
                    // flush mlog to processor
                    // unhardcode
                    if (coreData.lines[c] >= maxInstructionsPerProcessor) {

                        flushToProcessor(c)
                    }
                }
                coreData.processorFrame[c]++
            }
        
            globalFrame++
        }
    }

    // empty the cores for the last few frames since they contain fewer instructions than maxInstructionsPerProcessor
    for (let cc = 0; cc < cores; cc++) {

        // revert last increment
        coreData.processorFrame[cc] -= 1
        
        flushToProcessor(cc)
    }

    return processorIdentities
}

function assignLinksAndShite(processorIdentities, schemeArray, centerPosition) {
    // unhardcode     define links
    
    let links = []
    //links.push(new LogicBlock.LogicLink(0, 0, "display1", true))

    for (let y = 0; y < schemeArray.length; y++) {
        for (let x = 0; x < schemeArray[0].length; x++) {

            switch(schemeArray[y][x]) {

                // unhardcode change hardcoded linknames if possible
                case 1: // display
                    links.push(new LogicBlock.LogicLink(centerPosition.x + x, centerPosition.y + y, "display1", true))
                    break
                case 4: // cfg cell
                    links.push(new LogicBlock.LogicLink(centerPosition.x + x, centerPosition.y + y, "cell2", true))
                    break
                case 5: // clock cell
                    links.push(new LogicBlock.LogicLink(centerPosition.x + x, centerPosition.y + y, "cell1", true))
                    break
                default:
                    break
            }
        }
    }

    for (let i = 0; i < processorIdentities.length; i++) {
        processorIdentities[i].links = links
    }

    return processorIdentities
}

function placeSchemeArray(schemeArray, centerPosition, animation, commandInfo) {

    let animationLength = -1

    animation.forEach(
        (currentBatch) => {
            animationLength += currentBatch.batchSize
        }
    )

    for (let y = 0; y < schemeArray.length; y++) {
        for (let x = 0; x < schemeArray[0].length; x++) {
            //print(schemeArray[y][x] + " " + (centerPosition.x + x) + " " + (centerPosition.y + y))
            switch(schemeArray[y][x]) {

                // unhardcode change hardcoded linknames if possible
                case 1: // display
                    functions.placeBlock    (x + centerPosition.x + 2, y + centerPosition.y + 2, Blocks.largeLogicDisplay /* unhardcode */, undefined)
                    break
                case 2: // cfg proc
                    functions.placeProcessor(x + centerPosition.x, y + centerPosition.y, Blocks.microProcessor /* unhardcode */, 
                    mlogCodes.config.replace(/_FPS_/g, animation[0].fps / animation[0].step).replace(/_DISPLAYCOUNT_/g, 1 /* unhardcode value */), 
                    // unhardcode (link positions)
                        [
                            new LogicBlock.LogicLink(centerPosition.x + 7, centerPosition.y + 5, "cell1", true),
                            new LogicBlock.LogicLink(centerPosition.x + 8, centerPosition.y + 4, "switch1", true)
                        ]
                    )
                    break
                case 3: // clock proc
                    functions.placeProcessor(x + centerPosition.x, y + centerPosition.y, Blocks.worldProcessor /* unhardcode */, 
                    mlogCodes.clock.replace(/_MAXFRAME_/g, animationLength), 
                    // unhardcode (link positions)
                        [
                            new LogicBlock.LogicLink(centerPosition.x + 7, centerPosition.y + 5, "cell2", true),
                            new LogicBlock.LogicLink(centerPosition.x + 7, centerPosition.y + 4, "cell1", true),
                            new LogicBlock.LogicLink(centerPosition.x + 8, centerPosition.y + 4, "switch1", true)
                            
                        ]
                
                    )  
                    break
                case 4: // cfg cell
                    functions.placeBlock    (x + centerPosition.x, y + centerPosition.y, Blocks.memoryCell /* unhardcode */, undefined)
                    break
                case 5: // clock cell
                    functions.placeBlock    (x + centerPosition.x, y + centerPosition.y, Blocks.memoryCell /* unhardcode */, undefined)
                    break
                case 6: // cryo
                    functions.placeBlock    (x + centerPosition.x, y + centerPosition.y, Blocks.liquidSource /* unhardcode */, Liquids.cryofluid)
                    break
                case 7: // switch
                    functions.placeBlock    (x + centerPosition.x, y + centerPosition.y, Blocks.switchBlock /* unhardcode */, false)
                    break
                case 8: // description
                    functions.placeBlock    (x + centerPosition.x, y + centerPosition.y, Blocks.message, "Animation name: [lime]" + commandInfo[0] + "\n\n[white]Generated using the mod: [red]ElectricGun/Video-to-Logic  version [lime]" + config.rendererVersion)
                    break
                case -2:
                    functions.placeBlock    (x + centerPosition.x, y + centerPosition.y, Blocks.thoriumWall /* unhardcode */, false)
                    break
                default:
                    break
            }
        }
    }
}

function main () {
    let commandInfo = queue[0] // 0:name, 1: startpos,  2: compression, 3: proctype, 4: scale, 5: mode
    let startTime = Time.millis()        

    let startingPosition, compression
    try {
        startingPosition = commandInfo[1]
        compression = commandInfo[3]
    } catch (error) {
        // print(error.stack)
        return
    }
    
    if (compression < 0) {
        Log.infoTag("v2logic", "[ERROR] Argument compression must be greater than 0")
        Vars.ui.showInfoPopup("[ERROR] Argument compression must be greater than 0", 1, 1, 1, 1, 1, 1)
        queue.splice(0, 1)
        return
    }

    queue.splice(0, 1)

    let displayName = (startingPosition.x * Vars.world.height() + startingPosition.y).toString(16).slice(2)
    activeAnimations.splice(-1, 0, displayName)

    //    Reset log
    Vars.tree.get("logs/mlogs.txt").writeString(" ")

    // ------------------ begin process ------------------

    let animationData = loadAnimation(commandInfo[0])

    // generate processor code

    let processorIdentities = generateGraphicProcessors(commandInfo, animationData)

    // place the schematic skeleton

    // -2: wall, -1: occupied, 0: empty, 1: large_display, 2: config_processor, 3: clock_processor, 4: config_cell, 5: clock_cell, 6: cryofluid_source, 7: switch, 8: description

    // unhardcode    define placed objects
    let blocks = [
        [-2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2],
        [-2, -1, -1, -1, -1, -1, -1,  2, -2, -2, -2],
        [-2, -1, -1, -1, -1, -1, -1,  4, -2,  8, -2],
        [-2, -1, -1, -1, -1, -1, -1,  5,  7,  6, -2],   
        [-2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -2],
        [-2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -2],
        [-2,  1, -1, -1, -1, -1, -1,  3, -1, -1, -2],
        [-1, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2],
    ].reverse()

    placeSchemeArray(blocks, startingPosition, animationData.animation, commandInfo)
    
    processorIdentities = assignLinksAndShite(processorIdentities, blocks, startingPosition)

    // unhardcode    define offset
    let offset = {
        x: 0,
        y: 0
    }

    // unhardcode    define boundaries
    let boundaries = {
        x: 12,
        y: 12
    }

    let spiralIteration = 0

    // unhardcode to allow for other processor types and put the function outside the block
    function getSpiralCoords (iteration) {
        let coords = functions.spiral(iteration, 1, 0, 0)
        return coords
    }

    let setCoords = getSpiralCoords(0)
    processorIdentities.forEach(procObject => {
        let retry = false
        do {
            setCoords = getSpiralCoords(spiralIteration)

        // check if coords are within schematic boundaries 
        if ( 
            !(
            setCoords.y > blocks.length - 1 + offset.y || //x
            setCoords.x > blocks[0].length - 1 + offset.x || //y
            setCoords.y < 0 + offset.y ||
            setCoords.x < 0 + offset.x
            )
        ) {
            if (blocks[setCoords.y][setCoords.x] != 0) {
                retry = true
            } else {
                // unhardcode                                                 make this possible for multiblock sized processors, currently it only works for 1x1
                retry = false
            }
        } else (
            retry = false
        )

        if (retry) {
            spiralIteration++
        }
        } while (retry)
            
        functions.placeProcessor(
            setCoords.x += startingPosition.x, 
            setCoords.y += startingPosition.y, 
            procObject.type, 
            procObject.code,
            procObject.links,
        )

        //Core.app.setClipboardText(procObject.code)
        spiralIteration++
    })
    
    // ------------------- end process ------------------------

    // print time taken
    print("Time taken: " + (Time.millis() - startTime) + "ms")
}

module.exports = {
main: main,
addToQueue: addToQueue,
loadAnimation: loadAnimation}









