const mlogs = {
    clock: 
        [
            /*    cell1 0 frame number
                  cell1 1 batch number
                  cell1 2 isFinished
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

            // for testing
                "AMONG:",

            "jump SUS equal frame 1",
            "read impostor cell1 2",
            "jump AMONG notEqual impostor 1 ",
            
                "SUS:",
            //

            "write frame cell1 0",
            "write 0 cell1 1",
            "write 0 cell1 2",

            "jump END lessThan frame _MAXFRAME_",
            "wait 2",
            "set frame 0",
                "END:",

            "end",
                "OFF:",
            "set frame 0",
            "write 0 cell1 0",
            "write 0 cell1 1",
            "write 0 cell1 2",
            "draw clear 0 255 255",
            "drawflush display1"
        ].join("\n"),
    frameStart:
        [
            "op add counter counter 1",
            "jump _FINISHEDLABEL_ lessThan counter 2",  //number of repeat draws before finishing
            "write 1 cell1 2",  //finished
            "set counter 0",
            
                "_FINISHEDLABEL_:",

            "write 0 cell1 1",  //reset batch

                "_PREVLABEL_:",

            "read isFinished cell1 2",
            "read frame cell1 0",
            "read batch cell1 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            
            "write 0 cell1 2"
            //    insert frame
        ].join("\n"),
    frameHead:
        [
                "_PREVLABEL_:",

            "read isFinished cell1 2",
            "read frame cell1 0",
            "read batch cell1 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",


            "write 0 cell1 2"
            //    insert frame
        ].join("\n"),
    frameWithin:
        [
                "_PREVLABEL_:",

            "read isFinished cell1 2",
            "read frame cell1 0",
            "read batch cell1 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            
            "write 0 cell1 2"
            //    insert frame
        ].join("\n"),
    tail:
        [
            "drawflush display1",
            "op add counter counter 1",
            "jump _FINISHEDLABEL_ lessThan counter 2",  //number of repeat draws before finishing
            "write 1 cell1 2",  //finished
            "set counter 0",
            
                "_FINISHEDLABEL_:",

            "write 0 cell1 1",  //reset batch
        ].join("\n")
}

module.exports = mlogs
