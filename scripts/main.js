let renderer = require("v2logic/renderer")
let commands
try {
    commands = require("message-block-commands/message-executor")
} catch (e) {
    throw new Error("[v2Logic] ElectricGun/message-block-commands is not installed!")
}

const config = JSON.parse(Jval.read(Vars.tree.get("data/config.hjson").readString()))
const debugMode = config.debugMode  

function update() {
    if(!Vars.state.menu & !Vars.state.paused) {
        commands.readMessages()
    }
    renderer.main()
} 

Events.on(ConfigEvent, () => {
    update()
})

Events.on(TileChangeEvent, () => {
    update()
})
Events.on(ClientLoadEvent, () => {
    commands.setDebugMode(debugMode)

    //    Add command, header and the lot
    commands.setHeader("/", "v2logic")
    commands.addCommand("v2logic",
        [function out(messageBlock, mediaName, compression, scale, processorType) {
        renderer.addToQueue(mediaName, compression, scale, processorType, "classic", messageBlock)
        }, ["string", "int", "int", "string"]]
    )

    //    Test command
    commands.setHeader("/", "test")
    commands.addCommand("test",
        [function out(messageBlock, mediaName, compression, scale, processorType) {
        print("test")
        }, ["string", "int", "int", "string"]]
    )

    //    Add command for v2markers
    commands.setHeader("/", "v2markers")
    commands.addCommand("v2markers",
        [function out(messageBlock, mediaName, compression, scale) {
        renderer.addToQueue(mediaName, compression, scale, "worldProcessor", "markers", messageBlock)
        }, ["string", "int", "int"]]
    )

    Log.infoTag("[v2Logic]", "[lime]Video to Logic has successfully loaded. [white]Please read the mod's GitHub page for more info. \n  Available commands: \n /v2logic args = folderName, colourSkips, scale, processorType\n/v2markers args = folderName, colourSkips, scale")
})

/*
Timer.schedule(() => {
    if(!Vars.state.menu & !Vars.state.paused) {
        commands.readMessages()
    }
    renderer.render()
}, 0, .5)
*/