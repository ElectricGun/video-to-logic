const mlogCodes = {
    clock: 
        ["sensor enabled switch1 @enabled",
        "jump 0 equal enabled false",
        "set startTime @time",
        "op sub deltaTime @time startTime",
        "jump 3 lessThanEq deltaTime _PERIOD_",
        "set deltaTime 0",
        "op add frame frame 1",
        "write frame cell1 0"].join("\n")
}

module.exports = mlogCodes