/*TODO:

*/
var mlogCodes = require("mlogs")

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
    if (links != undefined) {
        if (links[0] != undefined) {
            for (let i = 0; i < links.length; i++) {
                currProcessor.links.add(links[i])
            }
        } else {
            currProcessor.links.add(links)
        }

    }
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
    queue.splice(0, 1)

    try {
        let nFrames = 0, second = 0, currFrame = 0
        startTime = Time.millis()
        
        for (let i = 0; i < totalBatches * animation[0].batchSize; i++) {
            let counter = i
            Packages.arc.util.Time.run(60 * i, () => {second = counter})
        };

        print(animation[0].seq[0].slice(-1)[0].slice(-1))
        let frameLength = animation[0].seq[0].slice(-1)[0][1]
        let frameHeight = animation[0].seq[0].slice(-1)[0][2]

        //    Place initial blocks
        placeBlock(startingPosition.x, startingPosition.y, Blocks.largeLogicDisplay)
        placeBlock(startingPosition.x - 2, startingPosition.y + 4, Blocks.memoryCell)
        placeBlock(startingPosition.x - 1, startingPosition.y + 4, Blocks.switchBlock, false)
        placeBlock(startingPosition.x + 3, startingPosition.y + 4, Blocks.liquidSource, Liquids.cryofluid)
        let mainLinks = [new LogicBlock.LogicLink(startingPosition.x, startingPosition.y, "display1", true),
                         new LogicBlock.LogicLink(startingPosition.x - 2, startingPosition.y + 4, "cell1", true),
                         new LogicBlock.LogicLink(startingPosition.x - 1, startingPosition.y + 4, "switch1", true)
                    ]
        placeProcessor(startingPosition.x + 1, startingPosition.y + 5, Blocks.hyperProcessor, mlogCodes.clock.replace("_PERIOD_", (1 / animation[0].fps) * 1000), mainLinks)
        
        /*
        for (let run = 0; run < totalBatches;run++) {                    //render all batches
            animation[run].batchNumber = run
            let data = animation[run]
            
            Packages.arc.util.Time.run(1/data.fps  * 60 * nFrames * data.step, () => {

                for (let i = 0; i < data.batchSize; i++) {            //render frame
                        let counter = i    //to fix issue with Time
                        let frame = data.seq[counter]

                        if (frame !== 'string') {

                            Packages.arc.util.Time.run(1/data.fps * 60 * i * data.step, () => {      

                                try {
                                    if (compressionType == 0) {
                                        for (let y = 0; y < frameHeight; y++) {
                                            for (let x = 0; x < frameLength; x++) {

                                                if (!(x == 0 && y == 0)) {
                                                    try {
                                                        let pixel = [frame[y][x]]
                                                        Vars.world.build(startingPosition.x + x, startingPosition.y + y).configure(Items[resources[pixel]])
                                                    } catch (e) {
                                                        //do nothing of there is no sorter
                                                    }
                                                }
                                            }
                                        }
                                    } else if (compressionType == 1) {
                                        let nPixel = 0
                                        while (true) { 
                                            let currFrameLength = frame.length
                                            if (nPixel > currFrameLength) {
                                                break
                                            }
                                            try {
                                                var packedPixel = frame[nPixel]
                                                var pixel = packedPixel[0]
                                                var pixX = packedPixel[1]
                                                var pixY = packedPixel[2]
                                            } catch (e) {
                                                nPixel += 1
                                                continue
                                            }
                                            if (!(pixX == 0 && pixY == 0)) {
                                                try {
                                                    Vars.world.build(startingPosition.x + pixX, startingPosition.y + pixY).configure(Items[resources[pixel]])
                                                } catch (e) {
                                                    //do nothing of there is no sorter
                                                }
                                            }
                                            nPixel += 1
                                        }
                                    }
                                } catch (error) {
                                    print(error.stack)
                                    print(error)
                                }

                                if (counter >= data.batchSize - 1 && run >= totalBatches - 1) {
                                    activeAnimations.splice(0, 1)
                                    print(displayName + "batch" + run + " finished")   //finished
                                }

                                let currTime = ((Time.millis() - startTime) / 1000)
                                let discrepancy = Math.floor(currTime - second)
                                //print(displayName + "  frame: " + currFrame+"    " + "batch: " + data.batchNumber+"   " + "time: "+currTime+",    " + discrepancy + " seconds behind" + "    in queue: " + queue.length)
                                print(discrepancy)
                                currFrame += 1
                            })

                        } else {
                            print("error")
                        }
                }
            })
            nFrames += data.batchSize
        }
        */
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

