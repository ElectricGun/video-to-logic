let Renderer = require("v2logic/renderer")
let Commands
try {
    Commands = require("message-block-commands/message-executor")
} catch (e) {
    throw new Error("[V2Logic] ElectricGun/message-block-commands is not installed!")
}

const config = JSON.parse(Jval.read(Vars.tree.get("data/config.hjson").readString()))
const debugMode = config.debugMode  

Events.on(ClientLoadEvent, () => {
    Commands.setHeader("/", "v2logic")
    Commands.setDebugMode(debugMode)
    Commands.addCommand("v2logic",
        [function out(messageBlock, mediaName, compression, scale, processorType) {
        Renderer.addToQueue(mediaName, compression, scale, processorType, messageBlock)
        },["string", "int", "int", "string"]]
    )
})

Timer.schedule(() => {
    if(!Vars.state.menu & !Vars.state.paused) {
        Commands.readMessages()
    }
    Renderer.render()
}, 0, .5)
