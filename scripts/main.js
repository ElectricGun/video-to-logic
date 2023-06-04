let Renderer = require("v2logic/renderer")
let Commands = require("message-block-commands/message-executor")

Events.on(ClientLoadEvent, () => {
    Commands.setHeader("/", "Video Maker")
    Commands.addCommand("v2logic",
        [function out(messageBlock, mediaName, compression, scale, processorType) {
        Renderer.addToQueue(mediaName, compression, scale, processorType, messageBlock)
        },["string", "string", "string"]]
    )
})

Timer.schedule(() => {
    if(!Vars.state.menu & !Vars.state.paused) {
        Commands.readMessages()
    }
    Renderer.render()
}, 0, .5)
