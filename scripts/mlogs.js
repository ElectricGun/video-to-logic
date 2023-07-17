/*
    Templates for processors 
*/

const mlogs = {
    clock: 
        [
            /*    cell1 0 frame number
                  cell1 1 batch number
                  cell1 2 isFinished
            */
            "jump START always 0 0",
            "set Generated Using",
            "set Mod ElectricGun/Video-to-Logic ",

                "START:",
            "setrate 100",
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
            "set frame 0",

                "END:",

            "end",
            
                "OFF:",

            "setrate 1000",

            "getlink linkedDisplay displayCounter",
            "op add displayCounter displayCounter 1",

            "read displayCount cell2 5",
            "set frame 0",
            "write 0 cell1 0",
            "write 0 cell1 1",
            "write 0 cell1 2",
            "draw clear 0 0 0",

            "op add displayCount2 displayCount 3",
            "jump ENDDISPLAYLOOP lessThanEq displayCounter displayCount2",
            "set displayCounter 0",
            "end",
                "ENDDISPLAYLOOP:",

            "drawflush linkedDisplay",

            "jump OFF always 0 0"
            
        ].join("\n"),
    config:
        [
            "set ipt 1000",
            "set refreshesPerCycle 1",
            "set forceRender 1",
            "set FPS _FPS_",
            "set noLock 0",
            "set displayCount _DISPLAYCOUNT_",

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
            "write noLock cell1 4",
            "write displayCount cell1 5",
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

            "setrate 25",
            "read noLock cell2 4",
            "jump _LOCK1LABEL_ equal noLock 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            
                "_LOCK1LABEL_:",

            "jump _NEXTLABEL_ notEqual frame _FRAME_",
            "read ipt cell2 0",
            "setrate ipt",
            /*

            "read ipt cell2 0",
            "setrate ipt",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",
*/

            "write 0 cell1 2"
            //    insert frame
        ].join("\n"),
    frameHead:
        [
                "_PREVLABEL_:",

            "read isFinished cell1 2",
            "read frame cell1 0",
            "read batch cell1 1",

            "setrate 25",
            "read noLock cell2 4",
            "jump _LOCK1LABEL_ equal noLock 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            
                "_LOCK1LABEL_:",

            "jump _NEXTLABEL_ notEqual frame _FRAME_",
            "read ipt cell2 0",
            "setrate ipt",

            /*
            "read ipt cell2 0",
            "setrate ipt",
            "read noLock cell2 4",
            "jump _LOCK2LABEL_ equal noLock 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",

                "_LOCK2LABEL_:",

            "jump _NEXTLABEL_ notEqual frame _FRAME_",
*/
            "write 0 cell1 2"
            //    insert frame
        ].join("\n"),
    frameWithin:
        [
                "_PREVLABEL_:",

            "read isFinished cell1 2",
            "read frame cell1 0",
            "read batch cell1 1",

            "setrate 25",
            "read noLock cell2 4",
            "jump _LOCK1LABEL_ equal noLock 1",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",

            "_LOCK1LABEL_:",

            "jump _NEXTLABEL_ notEqual frame _FRAME_",

            "read ipt cell2 0",
            "setrate ipt",

            /*
            "read ipt cell2 0",
            "setrate ipt",

            "read isFinished cell1 2",
            "jump _NEXTLABEL_ equal isFinished 1",
            "read batch cell1 1",
            "jump _NEXTLABEL_ notEqual batch _BATCH_",
            "read frame cell1 0",
            "jump _NEXTLABEL_ notEqual frame _FRAME_",
*/
            "write 0 cell1 2"
            //    insert frame
        ].join("\n"),
    frameNull:
        [
            ""
        ],
    tail:
        [
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