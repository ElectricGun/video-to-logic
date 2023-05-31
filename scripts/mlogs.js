const mlogs = {
    clock: 
        [
            /*    cell1 0 is frame number
                  cell1 1 is batch number
                  cell1 2 is finished status to prevent redrawing
            */
            "START:",

            "sensor enabled switch1 @enabled",
            "jump OFF equal enabled false",
            "set startTime @time",

            "HERE:",

            "op sub deltaTime @time startTime",
            "jump HERE lessThanEq deltaTime _PERIOD_",
            "set deltaTime 0",
            "op add frame frame 1",
            "write frame cell1 0",
            "write 0 cell1 1",
            "write 0 cell1 2",
            "jump END lessThan frame _MAXFRAME_",
            "set frame 0",

            "END:",

            "end",
            "OFF:",
            "set frame 1",
            "write 1 cell1 0",
            "write 0 cell1 1",
            "write 0 cell1 2",
            "draw clear 0 255 255",
            "drawflush display1"
        ].join("\n"),
    frameStart:
        [
            "write 0 cell1 1",
            "write 1 cell1 2",

            "_PREVLABEL_:",

            "read frame cell1 0",
            "read batch cell1 1",
            "read isFinished cell1 2",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            //"jump _NEXTLABEL_ equal isFinished 1"
            //"jump _NEXTLABEL_ lessThan isFinished -1"
            //    insert frame
        ].join("\n"),
    frameHead:
        [
            "_PREVLABEL_:",

            "read frame cell1 0",
            "read batch cell1 1",
            "read isFinished cell1 2",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            //"jump _NEXTLABEL_ equal isFinished 1"
            //"jump _NEXTLABEL_ lessThan isFinished -1"
            //    insert frame
        ].join("\n"),
    frameWithin:
        [
            "_PREVLABEL_:",

            "read frame cell1 0",
            "read batch cell1 1",
            "read isFinished cell1 2",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            //"jump _NEXTLABEL_ equal isFinished 1"
            //    insert frame
        ].join("\n"),
    frameEnd:
        [
            "_PREVLABEL_:",

            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_"
            //    insert frame
        ].join("\n")
}

module.exports = mlogs
