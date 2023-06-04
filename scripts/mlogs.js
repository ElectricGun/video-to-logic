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

            "read FPS cell2 3",
            "op div period 1 FPS",
            "op mul period period 1000",

            "op sub deltaTime @time startTime",
            "jump HERE lessThanEq deltaTime period",
            "set deltaTime 0",
            "op add frame frame 1",

            // for testing
                "AMONG:",
            "read forceRender cell2 2",
            "jump FORCERENDER equal forceRender 1",

            "jump SUS equal frame 1",
            "read impostor cell1 2",
            "jump AMONG notEqual impostor 1 ",
            
                "SUS:",

            "FORCERENDER:",
            // ---

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
            "draw clear 0 0 0",
            "drawflush display1"
        ].join("\n"),
    config:
        [
            "set ipt 255",
            "set refreshesPerCycle 2",
            "set forceRender 0",
            "set FPS _FPS_",

            "sensor enabled switch1 @enabled",
            "jump OFF equal enabled false",

            "write ipt cell1 0",
            "jump ON always 0 0",
            "OFF:",

            "write 25 cell1 0",

            "ON:",

            "write refreshesPerCycle cell1 1",
            "write forceRender cell1 2",
            "write FPS cell1 3",
        ].join("\n"),
    frameStart:
        [
            "op add counter counter 1",
            "read refreshesPerCycle cell2 1",
            "jump _FINISHEDLABEL_ lessThan counter refreshesPerCycle",  //number of repeat draws before finishing
            "write 1 cell1 2",  //finished
            "set counter 0",
            
                "_FINISHEDLABEL_:",

            "write 0 cell1 1",  //reset batch

                "_PREVLABEL_:",

            "read isFinished cell1 2",
            "read frame cell1 0",
            "read batch cell1 1",

            "read ipt cell2 0",
            "setrate ipt",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",


            "read ipt cell2 0",
            "setrate ipt",

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

            "read ipt cell2 0",
            "setrate ipt",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            "read ipt cell2 0",
            "setrate ipt",

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

            "read ipt cell2 0",
            "setrate ipt",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            "read ipt cell2 0",
            "setrate ipt",

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
            "read refreshesPerCycle cell2 1",
            "jump _FINISHEDLABEL_ lessThan counter refreshesPerCycle",  //number of repeat draws before finishing
            "write 1 cell1 2",  //finished
            "set counter 0",
            
                "_FINISHEDLABEL_:",

            "write 0 cell1 1",  //reset batch
        ].join("\n")
}

module.exports = mlogs
