package processes;

import arc.graphics.Color;
import arc.math.geom.Vec2;
import arc.struct.Seq;
import arc.struct.StringMap;
import datatypes.ColorNode;
import datatypes.SimpleQuadTree;
import datatypes.configs.MediaProcessConfig;
import datatypes.errors.MlogOverflowError;
import datatypes.errors.MlogThreadOverflowError;
import datatypes.mlog.Mlog;
import datatypes.mlog.MlogVideoFrame;
import mindustry.Vars;
import mindustry.content.Blocks;
import mindustry.game.Schematic;
import mindustry.logic.LExecutor;
import mindustry.world.Block;
import mindustry.world.Tile;
import mindustry.world.blocks.logic.LogicBlock;
import mindustry.world.blocks.logic.SwitchBlock;
import org.bytedeco.javacv.*;
import org.bytedeco.opencv.global.opencv_imgcodecs;
import org.bytedeco.opencv.opencv_core.Mat;
import resources.Mlogs;
import resources.ModMath;
import resources.ModVars;
import resources.Processes;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.*;
import org.bytedeco.opencv.opencv_core.Size;

import static org.bytedeco.opencv.global.opencv_imgproc.*;

public class MediaProcessThread extends ProcessThread {

    protected String pathToMedia;

    protected MediaProcessConfig mediaProcessConfig;
    protected FFmpegFrameGrabber fFmpegFrameGrabber;
    protected int numberOfFrames = 0;
    protected int currentFrame = 0;
    protected boolean started = false;
    protected boolean finished = false;
    protected boolean errored = false;


    private int count = 0; // for testing and debugging, ignore this

    public MediaProcessThread(String name, String pathToMedia, MediaProcessConfig mediaProcessConfig) {
        super(name);
        this.pathToMedia = pathToMedia;

        try {
            fFmpegFrameGrabber = new FFmpegFrameGrabber(pathToMedia);
            fFmpegFrameGrabber.start();
            numberOfFrames = fFmpegFrameGrabber.getLengthInFrames();
        } catch (Exception e) {
            shutdown();
        }

        this.mediaProcessConfig = mediaProcessConfig;
    }

    public boolean isErrored() {
        return errored;
    }

    public int getCurrentFrame() {
        return currentFrame;
    }

    public int getStart() {
        return mediaProcessConfig.startFrame;
    }

    public int getEnd() {
        return mediaProcessConfig.endFrame;
    }

    public int getNumberOfFrames() {
        return numberOfFrames;
    }

    public float getProgress() {
        return (float) (currentFrame + 1) / (mediaProcessConfig.endFrame + 1);
    }
    
    public void mediaToSchematic() {

        //unhardcode
        String display = "display1";
        String memcell1 = "cell1";
        String switch1 = "switch1";

        Map<MlogVideoFrame, Integer> mlogFrameCounts = new HashMap<>();
        //todo bug: some processors are not being filled completely for some reason
        Set<MlogVideoFrame> mlogVideoFrames = new HashSet<>();

        int maxImageLength = (LExecutor.maxInstructions - 4); // 2 header + 2 tail instructions

        try {
            OpenCVFrameConverter.ToMat converter = new OpenCVFrameConverter.ToMat();

            for (int frameNumber = mediaProcessConfig.startFrame; frameNumber <= mediaProcessConfig.endFrame; frameNumber += mediaProcessConfig.frameStep) {

                Mat image;
                if (!mediaProcessConfig.isImage)
                {fFmpegFrameGrabber.setFrameNumber(frameNumber);
                    Frame frame = fFmpegFrameGrabber.grabImage();
                    image = converter.convert(frame);
                    }
                else {
                    image = opencv_imgcodecs.imread(pathToMedia);
                }
                currentFrame = frameNumber;

                Mat resizedImage = new Mat();

                // unhardcode
                float scalingFactorX = mediaProcessConfig.newSize.x / image.cols();
                float scalingFactorY = mediaProcessConfig.newSize.y / image.rows();

                resize(image, resizedImage, new Size(0, 0), scalingFactorX, scalingFactorY, INTER_LINEAR);

                SimpleQuadTree<ColorNode> frameQuadtree = Processes.imageToQuadTree(resizedImage, mediaProcessConfig);
                Map<Color, List<ColorNode>> colorListMap = createColorListMap(frameQuadtree);

                int rects = 0; for (Color key : colorListMap.keySet()) rects+=colorListMap.get(key).size();
                int numberOfProcessors = (int) Math.max(1, Math.floor((float) rects / maxImageLength) * mediaProcessConfig.maxThreads);
                int threadLimit = Math.min(rects / numberOfProcessors, maxImageLength);

                //todo add multi display support and separate draw calls by display
                // ------------- start creating mlogs ----------------
                boolean frameEmpty = false;

                // to distribute draw calls between threads
                Set<MlogVideoFrame> frameMlogs = new HashSet<>();
                while (!frameEmpty) {
                    while (true) {
                        boolean nextThread = false;
//                        boolean finishedOnOverflow = false;
                        frameEmpty = true;

                        Queue<MlogVideoFrame> mlogVideoFrameQueue = new LinkedList<>(mlogVideoFrames);
                        MlogVideoFrame mlogVideoFrame = null;
                        if (!mlogVideoFrameQueue.isEmpty()) {
                            do {
                                mlogVideoFrame = mlogVideoFrameQueue.poll();
                            }
                            while (mlogVideoFrame != null && mlogVideoFrame.isDrawFull());
                        }
                        if (mlogVideoFrame == null) {
                            mlogVideoFrame = new MlogVideoFrame(display, LExecutor.maxInstructions, LExecutor.maxGraphicsBuffer, maxImageLength);
                        }

                        int currentMlogFrames = mlogFrameCounts.getOrDefault(mlogVideoFrame, 0);
                        mlogVideoFrame.label("@label" + currentMlogFrames);
                        mlogVideoFrame.newInstruction(Mlogs.read("frame", memcell1, 0));
                        mlogVideoFrame.newInstruction(Mlogs.jump("@label" + (currentMlogFrames + 1), Mlogs.Comparators.notEqual, "frame", String.valueOf(frameNumber)));

                        try {
                            for (Color color : colorListMap.keySet()) {
                                List<ColorNode> colorNodeList = colorListMap.get(color);
                                if (colorNodeList.isEmpty()) continue;
                                frameEmpty = false;

                                mlogVideoFrame.color(color.r * 255, color.g * 255, color.b * 255, color.a * 255);
                                Iterator<ColorNode> it = colorNodeList.iterator();

                                while (it.hasNext()) {
                                    ColorNode colorNode = it.next();
                                    float width = (colorNode.width);
                                    float height = (colorNode.height);
                                    float x = colorNode.x;
                                    float y = (resizedImage.rows() - colorNode.y) - height;
                                    // in displays, pixel positions are reduced by modulo 512 for some reason
                                    if (x < 512 && y < 512) {
                                        mlogVideoFrame.rect(x, y, width, height);
                                    }

                                    it.remove();

                                    if (mlogVideoFrame.getLength() >= threadLimit) {
                                        nextThread = true;
                                        throw new MlogThreadOverflowError("Reached maximum number of pixels in thread");
                                    }
                                }
                            }
                            mlogVideoFrame.endImage();
                        } catch (MlogOverflowError | MlogThreadOverflowError e) {
                            mlogVideoFrame.endImage();
                            // ModVars.infoTag(e);
                        }

                        if (frameEmpty) break;

                        mlogVideoFrame.label("@label" + (currentMlogFrames + 1));

                        if (mlogFrameCounts.containsKey(mlogVideoFrame)) {
                            mlogFrameCounts.put(mlogVideoFrame, mlogFrameCounts.get(mlogVideoFrame) + 1);
                        } else {
                            mlogFrameCounts.put(mlogVideoFrame, 1);
                        }

                        frameMlogs.add(mlogVideoFrame);

                        if (nextThread) break;
                    }
                }
                mlogVideoFrames.addAll(frameMlogs);

//                ModVars.infoTag(name + " Frame: " + frameNumber);

                if (mediaProcessConfig.isImage) {
                    break;
                }

                if (shutdown) {
                    ModVars.infoTag(this + " cancelled");
                    return;
                }
            }
            ModVars.infoTag(this + " finished without errors");
        } catch (Exception e) {
            errored = true;

            ModVars.infoTag("Processing error on frame: " + currentFrame);
            ModVars.infoTag(e);

            // bruh
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);
            e.printStackTrace(pw);
            String sStackTrace = sw.toString();
            ModVars.infoTag(sStackTrace);

            if (started) {
                ModVars.infoTag(this + " finished with errors");
                finish();
            } else {
                shutdown();
            }
        } finally {
            try {
                Block processorType = Blocks.microProcessor;
                Block switchType = Blocks.switchBlock;

                Vec2 startPosition = new Vec2(0, 0);
                Vec2 startDirection = new Vec2(0, 1);

                Vec2 borderStart = new Vec2(-1, -1);
                Vec2 borderEnd = new Vec2(7, 6);

                Vec2 lowestCoordinates = new Vec2(0, 0);
                Vec2 highestCoordinates = new Vec2(0, 0);

                int displayPosX = 2 + 1;
                int displayPosY = 2;


                Vec2 switch1Pos = null;
                Vec2 cell1Pos = null;
                Vec2 clockPos = null;

                if (!mediaProcessConfig.isImage) {
                    switch1Pos = new Vec2(startPosition);
                    startPosition = ModMath.spiralAround(startPosition, startDirection, 1, borderStart, borderEnd);
                    cell1Pos = new Vec2(startPosition);
                    startPosition = ModMath.spiralAround(startPosition, startDirection, 1, borderStart, borderEnd);
                    clockPos = new Vec2(startPosition);
                    startPosition = ModMath.spiralAround(startPosition, startDirection, 1, borderStart, borderEnd);
                }

                Map<Vec2, MlogVideoFrame> mlogImageMap = new HashMap<>();
                Seq<Schematic.Stile> stiles = new Seq<>();

                for (MlogVideoFrame _mlogImage : mlogVideoFrames) {
                    // end the processor codes
                    _mlogImage.endFrame();

                    lowestCoordinates.x = Math.min(startPosition.x, lowestCoordinates.x);
                    lowestCoordinates.y = Math.min(startPosition.y, lowestCoordinates.y);
                    highestCoordinates.x = Math.max(startPosition.x, highestCoordinates.x);
                    highestCoordinates.y = Math.max(startPosition.y, highestCoordinates.y);

                    mlogImageMap.put(new Vec2(startPosition.x, startPosition.y), _mlogImage);
                    startPosition = ModMath.spiralAround(startPosition, startDirection, 1, borderStart, borderEnd);
                }

                int offsetX = (int) Math.abs(lowestCoordinates.x);
                int offsetY = (int) Math.abs(lowestCoordinates.y);

                // switch1
                if (switch1Pos != null) {
                    SwitchBlock.SwitchBuild switchConfigBlock = (SwitchBlock.SwitchBuild) switchType.newBuilding();
                    switchConfigBlock.tile = new Tile((int) switch1Pos.x, (int) switch1Pos.y, Blocks.sand, Blocks.air, switchType);
                    switchConfigBlock.enabled = false;
                    stiles.add(new Schematic.Stile(switchType, (int) switch1Pos.x, (int) switch1Pos.y, switchConfigBlock.config(), (byte) 0));
                }

                // cell1
                if (cell1Pos != null) {
                    stiles.add(new Schematic.Stile(Blocks.memoryCell, (int) cell1Pos.x, (int) cell1Pos.y, null, (byte) 0));
                }

                // clock
                if (clockPos != null) {
                    //            sensor enabled switch1 @enabled
                    //            set start @startFrame
                    //            jump 9 notEqual enabled true
                    //            op add i i 1
                    //            op add i2 i start
                    //            jump 9 greaterThan i2 @endFrame
                    //            wait @interval
                    //            jump 10 always x false
                    //            end
                    //            set i 0
                    //            op add i2 i start
                    //            write i2 cell1 0
                    Mlog clockMlog = new Mlog(); clockMlog
                            .newInstruction("sensor enabled switch1 @enabled")
                            .newInstruction("set start " + mediaProcessConfig.startFrame)
                            .newInstruction("jump 9 notEqual enabled true")
                            .newInstruction("op add i i 1")
                            .newInstruction("op add i2 i start")
                            .newInstruction("jump 9 greaterThan i2 " + mediaProcessConfig.endFrame)
                            .newInstruction("wait " + (1 / fFmpegFrameGrabber.getFrameRate()))
                            .newInstruction("jump 10 always")
                            .newInstruction("end")
                            .newInstruction("set i 0")
                            .newInstruction("op add i2 i start")
                            .newInstruction("write i2 cell1 0")
                    ;

                    LogicBlock.LogicBuild clockProc = (LogicBlock.LogicBuild) processorType.newBuilding();
                    clockProc.tile = new Tile((int) clockPos.x, (int) clockPos.y, Blocks.sand, Blocks.air, processorType);
                    clockProc.links.add(new LogicBlock.LogicLink((int) cell1Pos.x, (int) cell1Pos.y, memcell1, true));
                    clockProc.links.add(new LogicBlock.LogicLink((int) switch1Pos.x, (int) switch1Pos.y, switch1, true));
                    clockProc.updateCode(clockMlog.getCode());
                    stiles.add(new Schematic.Stile(processorType, (int) clockPos.x, (int) clockPos.y, clockProc.config(), (byte) 0));
                }

                // display
                stiles.add(new Schematic.Stile(Blocks.largeLogicDisplay, displayPosX, displayPosY, null, (byte) 0));

                for (Schematic.Stile stile : stiles) {
                    stile.x += (short) offsetX;
                    stile.y += (short) offsetY;
                }

                for (Vec2 key : mlogImageMap.keySet()) {
                    MlogVideoFrame mlogImage = mlogImageMap.get(key);
                    Vec2 position = new Vec2(key.x + offsetX, key.y + offsetY);

                    LogicBlock.LogicBuild configBlock = (LogicBlock.LogicBuild) processorType.newBuilding();
                    configBlock.tile = new Tile((int) position.x, (int) position.y, Blocks.sand, Blocks.air, processorType);
                    configBlock.links.add(new LogicBlock.LogicLink(displayPosX + offsetX, displayPosY + offsetY, display, true));
                    if (cell1Pos != null)
                        configBlock.links.add(new LogicBlock.LogicLink((int) cell1Pos.x + offsetX, (int) cell1Pos.y + offsetY, memcell1, true));
                    configBlock.updateCode(mlogImage.getCode());
                    stiles.add(new Schematic.Stile(processorType, (int) position.x, (int) position.y, configBlock.config(), (byte) 0));
                }

                StringMap tags = new StringMap();
                tags.put("name", this + " frame " + currentFrame);

                Vars.schematics.add(new Schematic(stiles, tags,
                        Math.max((int) (offsetX + highestCoordinates.x), 25),
                        Math.max((int) (offsetY + highestCoordinates.y), 25)));
            } catch (Exception e) {
                // bruh
                StringWriter sw = new StringWriter();
                PrintWriter pw = new PrintWriter(sw);
                e.printStackTrace(pw);
                String sStackTrace = sw.toString();
                ModVars.infoTag(sStackTrace);
            } finally {
                currentFrame = mediaProcessConfig.endFrame;
                finish();
            }
        }

    }

    protected void finish() {
        finished = true;
    }

    public boolean isFinished() {
        return finished;
    }

    @Override
    protected void method() {
        if (!finished) mediaToSchematic();
    }

    public String getPathToMedia() {
        return pathToMedia;
    }

    protected Map<Color, List<ColorNode>> createColorListMap(SimpleQuadTree<ColorNode> simpleQuadTree) {
        Map<Color, List<ColorNode>> colorListMap = new HashMap<>();
        count = 0;
        createColorListMapHelper(simpleQuadTree, colorListMap);
        return colorListMap;
    }

    protected void createColorListMapHelper(SimpleQuadTree<ColorNode> quadTree, Map<Color, List<ColorNode>> colorListMap) {

        if (quadTree.data != null) {
            if (!colorListMap.containsKey(quadTree.data.color)) {
                ArrayList<ColorNode> nodeArrayList = new ArrayList<>();
                nodeArrayList.add(quadTree.data);
                colorListMap.put(quadTree.data.color, nodeArrayList);
                count ++;
            } else {
                colorListMap.get(quadTree.data.color).add(quadTree.data);
                count++;
            }
        }

        if (quadTree.botLeft != null) {
            createColorListMapHelper(quadTree.botLeft, colorListMap);
        }
        if (quadTree.botRight != null) {
            createColorListMapHelper(quadTree.botRight, colorListMap);
        }
        if (quadTree.topLeft != null) {
            createColorListMapHelper(quadTree.topLeft, colorListMap);
        }
        if (quadTree.topRight != null) {
            createColorListMapHelper(quadTree.topRight, colorListMap);
        }
    }


    // testing stuff, ignore it everything below this

    // creates schematic consisting of walls
    private Schematic createTestSchematic(SimpleQuadTree<ColorNode> quadTree, int width, int height) {
        Seq<Schematic.Stile> stiles = new Seq<>();
        Map<Vec2, Schematic.Stile> stileMap = new HashMap<>();
        count = 0;
        testSchematicHelper(quadTree, stileMap, width, height);

        for (Vec2 vec2 : stileMap.keySet()) {
            stiles.add(stileMap.get(vec2));
        }

        StringMap tags = new StringMap();
        tags.put("name", this + " frame " + currentFrame);
        return new Schematic(stiles, tags, width, height);
    }
    private void testSchematicHelper(SimpleQuadTree<ColorNode> quadTree, Map<Vec2, Schematic.Stile> stileMap, int width, int height) {
        if (quadTree.data != null) {
            count++;
            ColorNode data = quadTree.data;
            Block[] blocks = {Blocks.copperWall, Blocks.carbideWall, Blocks.titaniumWall, Blocks.plastaniumWall};

            for (int x = 0; x < data.width; x++) {
                for (int y = 0; y < data.height; y++) {
                    int positionX = x + data.x;
                    int positionY = height - (y + data.y);
                    Vec2 position = new Vec2(positionX, positionY);
                    if (quadTree.data.color.sum() / 3 > .2) {
                        stileMap.put(position, new Schematic.Stile(blocks[count % blocks.length], positionX, positionY, null, (byte) 0));
                    } else {
                        stileMap.remove(position);
                    }
                }
            }
        }

        if (quadTree.botLeft != null) {
            testSchematicHelper(quadTree.botLeft, stileMap, width, height);
        }
        if (quadTree.botRight != null) {
            testSchematicHelper(quadTree.botRight, stileMap, width, height);
        }
        if (quadTree.topLeft != null) {
            testSchematicHelper(quadTree.topLeft, stileMap, width, height);
        }
        if (quadTree.topRight != null) {
            testSchematicHelper(quadTree.topRight, stileMap, width, height);
        }
    }
}
