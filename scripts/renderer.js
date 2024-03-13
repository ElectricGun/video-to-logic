/*TODO:

    IMPORTATN VERY VERY IMPORTANT:
        instead of placing a processor with code for every cycle, save that mlog code to an array of codes, then build the processors after.

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


const Functions = require("v2logic/functions")
const config = JSON.parse(Jval.read(Vars.tree.get("data/config.hjson").readString()))
const mlogCodes = require("v2logic/mlogs")
const { markerPixelTrans } = require("./mlogs")

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

function addToQueue(name, compression, scale, processorType, mode, messageBlock) {
    let x = messageBlock.x / 8
    let y = messageBlock.y / 8
    let data = [name, Vec2(x, y), compression, processorType, Math.floor(scale), mode]
    queue.push(data)
}

function defineAnimation (name) {
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
                                                    /////////////////                  main func            ////////////////////
function main () {
    let animationInfo = queue[0]
    let startTime = Time.millis()
    let startingPosition, frame, data, displayName, compression, processorTypeStr, scale, mode

    try {
        startingPosition = animationInfo[1]
        compression = animationInfo[2]
        processorTypeStr = animationInfo[3]
        scale = animationInfo[4]
        mode = animationInfo[5]
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
        isRaw = header.isRaw
    } catch(e) {
        Log.infoTag("v2logic", "[ERROR] Invalid animation folder")
        Vars.ui.showInfoPopup("[ERROR] Invalid animation folder", 1, 1, 1, 1, 1, 1)
        queue.splice(0, 1)
    }
    queue.splice(0, 1)

    try {

        //    Reset log
        Vars.tree.get("logs/mlogs.txt").writeString(" ")

        startTime = Time.millis()
        
        let totalFrames = 0
        let step = animation[0].step

        for (let i = 0; i < totalBatches; i++) {
            totalFrames += animation[i].batchSize
        };
    
            //    Define animation size and number of displays

        let size = Functions.defineFrameSize(animation[0].seq[0])
        const displaySize = 180
        const offsetOneMult = new Vec2((size.x + 1) / size.x, (size.y + 1) / size.y)    //    Multiply pixels by this so that it fits the display
        const displayAmount = new Vec2(Math.ceil((size.x * scale) / displaySize), Math.ceil((size.y * scale) / displaySize))
        
             //    Define the displays and their links

        let displayLinks = []
        let displayOffset = new Vec2(0, 0)
        let displayCounter = 0
        const displayStartingPosition = new Vec2(startingPosition.x + ((displayAmount.x - 1) * -6), startingPosition.y + ((displayAmount.y - 1) * -6))
        let displayTiles = []
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

        //    Place logic displays
        displayTiles.forEach(b => {
            if (b.type == "block") {
                try {
                    Functions.placeBlock(b.x, b.y, b.block, b.config)
                } catch (e) {
                    Log.infoTag("v2logic", "[ERROR] Error when placing displays, is your animation too large?")
                    Vars.ui.showInfoPopup("[ERROR] Error when placing displays, is your animation too large?", 5, 1, 1, 1, 1, 1)
                    print(e.stack)
                    print(e)
                }
            } else {
                Log.infoTag("v2logic","[ERROR] Invalid block type... skipping")
                Vars.ui.showInfoPopup("[ERROR] Invalid block type... skipping", 1, 1, 1, 1, 1, 1)
            }
        })
        
        const configLinks = Functions.defineConfigLinks(startingPosition)

        const mainLinks = Functions.defineMainLinks(startingPosition, displayLinks).concat(displayLinks)

        let processorType = Functions.getProcessorType(processorTypeStr)

        Functions.placeStartingBlocks(startingPosition, processorTypeStr, configLinks, displayAmount, animation, animationInfo)

        Functions.placeWalls(startingPosition, processorTypeStr)

        //    Place clock processor
        Functions.placeProcessor(startingPosition.x + 1, startingPosition.y + 5, processorType.block, mlogCodes.clock
            .replace(/_MAXFRAME_/g, 0), mainLinks)



        // oh my god fix whatever this is   AHHHHHHHHHHH       TODO define mode

        if (mode == "classic") {

            renderClassic(animation, animationInfo, displayAmount, processorType, header, totalBatches, isRaw, displaySize, displayIDArray, size, mainLinks, totalFrames)
            .forEach(processor => Functions.placeProcessor(processor.positionX, processor.positionY, processor.type, processor.code, processor.links))
        } else if (mode == "markers") {
            renderMarkers(animation, animationInfo, displayAmount, processorType, header, totalBatches, isRaw, displaySize, displayIDArray, size, mainLinks, totalFrames)
            .forEach(processor => Functions.placeProcessor(processor.positionX, processor.positionY, processor.type, processor.code, processor.links))
       
        }


    } catch (error) {
        Log.infoTag("v2logic",error.stack)
        Log.infoTag("v2logic",error);
    }
}

// aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa cant have too many args amirite

function renderClassic (animation, animationInfo, displayAmount, processorType, header, totalBatches, isRaw, displaySize, displayIDArray, size, mainLinks, totalFrames) {

    let startingPosition = animationInfo[1]
    let compression = animationInfo[2]
    let scale = animationInfo[4]

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
    let displayName2 = ""

    let offset = Vec2(0, 0)

    let prevOffsetX = 0
    let prevOffsetY = 0

    let maxOffset = Vec2(0, 0)
    let minOffset = Vec2(0, 0)

    let spiralIteration = 0
    let spiralOffset = Vec2(0, 0)
    
    //        BEGIN PROCESSING

    let processorIdentities = []
    
    if (header.compressed == 1) {

        processorCode = ""

        function calculateProcessorLocation() {
            spiralOffset = Functions.spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
            offset.x = spiralOffset.x
            offset.y = spiralOffset.y

            while (Functions.dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorType.range ||
                    Functions.dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorType.range ||

                    ((startingPoint.x + offset.x > startingPosition.x + panelMin.y - Math.ceil(processorType.size / 2) && startingPoint.x + offset.x < startingPosition.x + panelMax.x + Math.ceil(processorType.size / 2)) &&
                    (startingPoint.y + offset.y > startingPosition.y + panelMin.y - Math.ceil(processorType.size / 2) && startingPoint.y + offset.y < startingPosition.y + panelMax.y + Math.ceil(processorType.size / 2))) ||

                    (offset.x == prevOffsetX && offset.y == prevOffsetY)
                    ) {

                spiralOffset = Functions.spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                offset.x = spiralOffset.x
                offset.y = spiralOffset.y
                spiralIteration += 1

                if ((offset.x + processorType.size > processorType.range * 4) &&
                    (offset.y + processorType.size > processorType.range * 4)) {

                    Log.infoTag("v2logic","[ERROR] Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)
                    Vars.ui.showInfoPopup("[ERROR] Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames, 1, 1, 1, 1, 1, 1)

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
                    
                    processorCode += mlogCodes.frameHead.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                        .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                        .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                        .replace(/_LOCK1LABEL_/g, "LOCK1" + processorFrame)
                                                        .replace(/_FRAME_/g, globalFrame) + "\n"
                lines += 20 + 1
                }

                let prevColour = []
                let prevDisplayName = null
                let currColCalls = 0

                //    For creating large pixels for better compression
                let pixelSizeMultiplier = new Vec2(1, 1)

                for (let p = 0; p < currFrameLength; p++) {
                    let currPixel = currFrame[p]
                    let colour = currPixel[0]
                    let pixelPos = Vec2(currPixel[1] * scale, currPixel[2] * scale)
                    let pixSize = 1 * scale

                    let pixelDisplayPos = Functions.defineDisplayPositionAndOffset(pixelPos.x, pixelPos.y, displaySize)
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

                    if (isWithinImageBorder.x1) {
                        pixelMultiplier.x *= 4
                    }

                    if (isWithinImageBorder.y1) {
                        pixelMultiplier.y *= 4
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
                        
                        processorCode += markerPixelTrans + "\n"
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
                    if (lines + 6 + 27 > maxLines) {
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
                        processorIdentities.push(createProcessorIdentity(Vec2(startingPoint.x + Math.floor(offset.x), startingPoint.y + Math.floor(offset.y)),  processorType.block, processorCode, mainLinks))
                       

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
                processorIdentities.push(createProcessorIdentity(Vec2(startingPoint.x + offset.x, startingPoint.y + offset.y),  processorType.block, processorCode, mainLinks))


                //    Place clock processor
                processorIdentities.push(createProcessorIdentity(Vec2(startingPosition.x + 1, startingPosition.y + 5),  processorType.block,  mlogCodes.clock.replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks))
            }
        }
        
    }
    return processorIdentities
}

function renderMarkers (animation, animationInfo, displayAmount, processorType, header, totalBatches, isRaw, displaySize, displayIDArray, size, mainLinks, totalFrames) {

    let startingPosition = animationInfo[1]
    let compression = animationInfo[2]
    let scale = animationInfo[4]

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
    let displayName2 = ""

    let offset = Vec2(0, 0)

    let prevOffsetX = 0
    let prevOffsetY = 0

    let maxOffset = Vec2(0, 0)
    let minOffset = Vec2(0, 0)

    let spiralIteration = 0
    let spiralOffset = Vec2(0, 0)
    
    //        BEGIN PROCESSING

    let processorIdentities = []
    
    if (header.compressed == 1) {

        processorCode = ""

        function calculateProcessorLocation() {
            spiralOffset = Functions.spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
            offset.x = spiralOffset.x
            offset.y = spiralOffset.y

            while (Functions.dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x, startingPosition.y) > processorType.range ||
                    Functions.dist(startingPoint.x + offset.x, startingPoint.y + offset.y, startingPosition.x - 2, startingPosition.y + 4) > processorType.range ||

                    ((startingPoint.x + offset.x > startingPosition.x + panelMin.y - Math.ceil(processorType.size / 2) && startingPoint.x + offset.x < startingPosition.x + panelMax.x + Math.ceil(processorType.size / 2)) &&
                     (startingPoint.y + offset.y > startingPosition.y + panelMin.y - Math.ceil(processorType.size / 2) && startingPoint.y + offset.y < startingPosition.y + panelMax.y + Math.ceil(processorType.size / 2))) ||

                    (offset.x == prevOffsetX && offset.y == prevOffsetY)
                    ) {

                spiralOffset = Functions.spiral(spiralIteration, processorType.size, processorType.squishX, processorType.squishY)
                offset.x = spiralOffset.x
                offset.y = spiralOffset.y
                spiralIteration += 1

                if ((offset.x + processorType.size > processorType.range * 4) &&
                    (offset.y + processorType.size > processorType.range * 4)) {

                    Log.infoTag("v2logic","[ERROR] Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames)
                    Vars.ui.showInfoPopup("[ERROR] Sequence way too large, only " + globalFrame + " rendered out of " + totalFrames, 1, 1, 1, 1, 1, 1)

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

                let drawBuffer = drawBufferFactor / (currFrameLength / maxLines)

                //    Define frame header
                if (globalFrame != 1) {

                    processorCode += mlogCodes.frameStart.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                         .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                         .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                         .replace(/_FINISHEDLABEL_/g, "FINISH" + processorFrame)
                                                         .replace(/_LOCK1LABEL_/g, "LOCK1" + processorFrame)
                                                         .replace(/_FRAME_/g, globalFrame) + "\n"
                lines += 26 + 1
                
                } else {
                    
                    processorCode += mlogCodes.frameHead.replace(/_PREVLABEL_/g, "LABEL" + processorFrame)
                                                        .replace(/_NEXTLABEL_/g, "LABEL" + (processorFrame + 1))
                                                        .replace(/_BATCH_/g, frameProcessorBatchNumber)
                                                        .replace(/_LOCK1LABEL_/g, "LOCK1" + processorFrame)
                                                        .replace(/_FRAME_/g, globalFrame) + "\n"
                lines += 20 + 1
                }

                let prevColour = []
                let prevDisplayName = null

                //    For creating large pixels for better compression
                let pixelSizeMultiplier = new Vec2(1, 1)

                for (let p = 0; p < currFrameLength; p++) {
                    let currPixel = currFrame[p]
                    let colour = currPixel[0]
                    let pixelPos = Vec2(currPixel[1] * scale, currPixel[2] * scale)
                    let pixSize = scale

                    //    Define colour
                    let rgb = []
                    if (!isRaw) {
                        rgb = palette[colour]
                    } else {
                        rgb = colour
                    }

                    let pixelMultiplier = new Vec2(1, 1)

                    //    --------------------------------Draw the pixel-----------------------------------

                    //processorCode += mlogCodes.markerPixelFixed + "\n"
                    processorCode += "set x " + pixelPos.x + "\n"
                    processorCode += "set y " + pixelPos.y + "\n"
                    processorCode += "op mul id x 141\nop add id id y \n"
                    processorCode += "setmarker color id %" + Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1) + "\n"
                    processorCode += mlogCodes.markerPixelTrans + "\n"
                    lines += 5 + 18

                    //    ---------------------------------------------------------------------------------

                    //    Flush mlog to processor
                    if (lines + 6 + 27 > maxLines) {
                        currProcessor += 1
                        lines = 0
                        frameProcessorBatchNumber += 1

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
                        processorIdentities.push(createProcessorIdentity(Vec2(startingPoint.x + Math.floor(offset.x), startingPoint.y + Math.floor(offset.y)),  processorType.block, processorCode, mainLinks))
                       

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
                processorIdentities.push(createProcessorIdentity(Vec2(startingPoint.x + offset.x, startingPoint.y + offset.y),  processorType.block, processorCode, mainLinks))


                //    Place clock processor
                processorIdentities.push(createProcessorIdentity(Vec2(startingPosition.x + 1, startingPosition.y + 5),  processorType.block,  mlogCodes.clock.replace(/_MAXFRAME_/g, globalFrame - 1), mainLinks))
            }
        }
        
    }
    return processorIdentities
}

module.exports = {
main: main,
addToQueue: addToQueue,
defineAnimation: defineAnimation}
