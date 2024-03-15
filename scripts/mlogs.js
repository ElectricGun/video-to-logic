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
            "set noLock 1",
            "set displayCount _DISPLAYCOUNT_",
            "set offset_x 0",
            "set offset_y 0",

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
            "write offset_x cell1 6",
            "write offset_y cell1 7",
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

            "setrate 5",
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

            "setrate 5",
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

            "setrate 5",
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
        ].join("\n"),


        /*--------------v2marker---------------*/

    markerPixelTrans:
        [
            "read new_x cell2 6",
            "read new_y cell2 7",
            "op add new_x new_x x",
            "op add new_y new_y y",
            "op add x0 new_x -1",
            "op add y0 new_y -1",
            "op add y1 new_y 1",
            "op add x1 new_x 1",
            "setmarker posi id 0 x0 y0",
            "setmarker posi id 1 x0 y1",
            "setmarker posi id 2 x1 y0",
            "setmarker posi id 3 x1 y1",
        ].join("\n"),
    markerPixelFixed:
        [
            "op add x0 x -1",
            "op add y0 y -1",
            "op add y1 y 1",
            "op add x1 x 1",
            "setmarker posi id 0 x0 y0",
            "setmarker posi id 1 x0 y1",
            "setmarker posi id 2 x1 y0",
            "setmarker posi id 3 x1 y1",
        ].join("\n"),

        // ID formula = (x + offset_x) * size_x + y
        
    makeMarkers:
        [
            "set id_offset _ID_OFFSET_",
            "setrate 1000",
            "set size_x _SIZE_X_",
            "set size_y _SIZE_Y_",
            "set x 0",
            "op add id_x x id_offset",
            "op mul id id_x size_x",
            "op add id id y",
            "makemarker shape id x y true",
            "op add x x 1",
            "jump 4 lessThan x size_x",
            "op add y y 1",
            "jump 3 lessThan y size_y",
            "stop",
            
        ].join("\n"),
    destroyMarkers:
        [
            "set id_offset _ID_OFFSET_",
            "setrate 1000",
            "set size_x _SIZE_X_",
            "set size_y _SIZE_Y_",
            "set x 0",
            "op add id_x x id_offset",
            "op mul id id_x size_x",
            "op add id id y",
            "setmarker remove id 0 0 0",
            "op add x x 1",
            "jump 4 lessThan x size_x",
            "op add y y 1",
            "jump 3 lessThan y size_y",
            "stop",
        ].join("\n"),
}

module.exports = mlogs


/*

set id_offset _ID_OFFSET_
setrate 1000
set size_x _SIZE_X_
set size_y _SIZE_Y_
set x 0
op add id_x x id_offset
op mul id id_x size_x
op add id id y
makemarker shape id x y true
op add x x 1
jump 4 lessThan x size_x
op add y y 1
jump 3 lessThan y size_y
stop

set id_offset _ID_OFFSET_
setrate 1000
set size_x _SIZE_X_
set size_y _SIZE_Y_
set x 0
op add id_x x id_offset
op mul id id_x size_x
op add id id y
setmarker remove id 0 0 0
op add x x 1
jump 4 lessThan x size_x
op add y y 1
jump 3 lessThan y size_y
stop

setrate 1000
sensor enabled switch1 @enabled
set size_x 141
set size_y 141
sensor origin_x @this @x
sensor origin_y @this @y
op mul id x size_x
op add id id y
jump 24 notEqual enabled true
jump 25 equal status 1
makemarker quad id x y true
op add x0 x -1
op add y0 y -1
setmarker posi id 0 x0 y0
op add x1 x -1
op add y1 y 1
setmarker posi id 1 x1 y1
op add x2 x 1
op add y2 y -1
setmarker posi id 2 x2 y2
op add x3 x 1
op add y3 y 1
setmarker posi id 3 x3 y3
jump 25 always enabled false
setmarker remove id x y 0
op add x x 1
jump 6 lessThan x 141
set x 0
op add y y 1
jump 6 lessThan y 141
set y 0
set status enabled

setrate 1000
sensor enabled switch1 @enabled
set size_x 141
set size_y 141
sensor origin_x @this @x
sensor origin_y @this @y
op mul id x size_x
op add id id y
jump 25 notEqual enabled true
jump 26 equal status 1
makemarker quad id x y true
op add x0 x -1
op add y0 y -1
setmarker posi id 0 x0 y0
op add x1 x -1
op add y1 y 1
setmarker posi id 1 x1 y1
op add x2 x 1
op add y2 y -1
setmarker posi id 2 x2 y2
op add x3 x 1
op add y3 y 1
setmarker posi id 3 x3 y3
setmarker color id %000000 x3 y3
jump 26 always enabled false
setmarker remove id x y 0
op add x x 1
jump 6 lessThan x 141
set x 0
op add y y 1
jump 6 lessThan y 141
set y 0
set status enabled

v2markers args = monke,255,1
*/

