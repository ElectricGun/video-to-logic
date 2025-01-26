package resources;

import arc.graphics.Color;
import arc.math.geom.Vec3;
import arc.util.Threads;
import datatypes.ColorNode;
import datatypes.configs.FrameConfig;
import datatypes.SimpleQuadTree;
import datatypes.configs.MediaProcessConfig;
import org.bytedeco.ffmpeg.avformat.AVFormatContext;
import org.bytedeco.ffmpeg.global.avformat;
import org.bytedeco.javacpp.BytePointer;
import org.bytedeco.opencv.opencv_core.Mat;
import processes.MediaProcessThread;

public class Processes {

    public static MediaProcessThread runProcessVideoThread(String pathToVideo, MediaProcessConfig mediaProcessConfig) {
        MediaProcessThread frameProcessThread = new MediaProcessThread("Process " + SessionData.getThreads().size(), pathToVideo, mediaProcessConfig);
        Threads.thread(frameProcessThread);
        SessionData.addThread(frameProcessThread);
        return frameProcessThread;
    }

    public static Color pickColour (Mat image, int y, int x) {
        BytePointer pointer = image.ptr(y, x);
        // & 0xFF converts everything to unsigned
        float r = 0, g = 0, b = 0, a = 255;
        if (image.channels() >= 3) {
            byte[] pixel = new byte[image.channels()];
            pointer.get(pixel);
            r = pixel[0] & 0xFF; g = pixel[1] & 0xFF; b = pixel[2] & 0xFF;
            if (image.channels() == 4) a = pixel[3] & 0xFF;
        } else if (image.channels() == 1) {
            float value = pointer.get() & 0xFF;
            r = value; g = value; b = value;
        }
        // opencv uses bgra for some reason
        return new Color(b / 255, g / 255, r / 255, a / 255);
    }

    public static SimpleQuadTree<ColorNode> imageToQuadTree(Mat image, FrameConfig frameConfig) {
        SimpleQuadTree<ColorNode> output = new SimpleQuadTree<>(null);
        //ModVars.infoTag(image.cols() + "  " + image.rows());
        return imageToQuadtreeHelper(output, image, 0, 0, image.cols(), image.rows(), frameConfig);
    }

    protected static SimpleQuadTree<ColorNode> imageToQuadtreeHelper(SimpleQuadTree<ColorNode> output, Mat image,
                                                                     int startX, int startY, int width, int height,
                                                                     FrameConfig frameConfig) {
        float totalR = 0; float totalG = 0; float totalB = 0;
        int totalPixels = 0;

        // calculate average colour
        for (int y = 0; y < height; y += (int) frameConfig.pixelStep.y) {
            int pointerY = y + startY;
            for (int x = 0; x < width; x += (int)  frameConfig.pixelStep.x) {
                int pointerX = x + startX;

                Color color = pickColour(image, pointerY, pointerX);
                totalR += color.r; totalB += color.b; totalG += color.g;
                totalPixels ++;
            }
        }

        totalR /= totalPixels;
        totalG /= totalPixels;
        totalB /= totalPixels;

        Color outputColor = new Color(totalR, totalG, totalB);
        if (width <= frameConfig.minPixelSize || height <= frameConfig.minPixelSize) {
            output.data = new ColorNode(outputColor, startX, startY, width, height);
            return output;
        }

        // check for pixel similarity; if similar to average, then output this square and stop
        // if too inaccurate, change from Euclidean to something else

        // humans see greens and blues better than reds apparently
        Vec3 weights = new Vec3(2, 4, 3);
        double clamper = ModMath.len3(weights.x, weights.y, weights.z);

        boolean doSplit = false;
        for (int y = 0; y < height; y += (int) frameConfig.pixelStep.y) {
            if (doSplit) break;
            int pointerY = y + startY;
            for (int x = 0; x < width; x += (int) frameConfig.pixelStep.x) {
                int pointerX = x + startX;
                Color color = pickColour(image, pointerY, pointerX);

                double distance = ModMath.len3(
                        (totalR - color.r) * weights.x,
                        (totalG - color.g) * weights.y,
                        (totalB - color.b) * weights.z)
                        / clamper;

                if (distance > frameConfig.tolerance) {
                    doSplit = true;
                    break;
                }
            }
        }
        if (!doSplit) {
            output.data = new ColorNode(outputColor, startX, startY, width, height);
        } else {
            int halfWidth = width / 2;
            int widthRemainder = (int) Math.ceil(width % 2);
            int halfHeight = height / 2;
            int heightRemainder = (int) Math.ceil(height % 2);

            output.botLeft  = (imageToQuadtreeHelper(new SimpleQuadTree<>(null), image,
                    // bottom left
                    startX, startY, halfWidth + widthRemainder, halfHeight + heightRemainder,
                    frameConfig));
            output.botRight = (imageToQuadtreeHelper(new SimpleQuadTree<>(null), image,
                    // bottom right
                    startX + halfWidth + widthRemainder, startY, halfWidth, halfHeight + heightRemainder,
                    frameConfig));
            output.topLeft  = (imageToQuadtreeHelper(new SimpleQuadTree<>(null), image,
                    // top left
                    startX, startY + halfHeight + heightRemainder, halfWidth + widthRemainder, halfHeight,
                    frameConfig));
            output.topRight = (imageToQuadtreeHelper(new SimpleQuadTree<>(null), image,
                    // top right
                    startX + halfWidth + widthRemainder, startY + halfHeight + heightRemainder, halfWidth, halfHeight,
                    frameConfig));
        }
        return output;
    }
}
