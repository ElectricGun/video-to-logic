let Renderer = require("v2logic/renderer")
let Commands = require("message-block-commands/message-executor")

var selfDestruct;

Events.on(ClientLoadEvent, () => {
    Commands.setHeader("/", "Video Maker")
    Commands.addCommand("v2logic",
        [function out(messageBlock, mediaName, taskName) {
        Renderer.addToQueue(mediaName, taskName, messageBlock)
        },["string", "string"]]
    )
})

Timer.schedule(() => {
    if(!Vars.state.menu & !Vars.state.paused) {
        Commands.readMessages()
    }
    Renderer.render()
}, 0, .5)
