package resources;

import arc.ApplicationListener;
import arc.Core;
import arc.files.Fi;
import org.bytedeco.javacpp.Loader;
import processes.MediaProcessThread;
import processes.ProcessThread;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import ui.UI;
import ui.dialogs.ErrorDialog;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class SessionData {

    private static Fi selectedFile;
    private static int mediaFrameCount;
    private static int mediaWidth;
    private static int mediaHeight;

    private static List<MediaProcessThread> threads = new ArrayList<>();

    public static int getMediaFrameCount() {
        return mediaFrameCount;
    }

    public static int getMediaWidth() {
        return mediaWidth;
    }

    public static int getMediaHeight() {
        return mediaHeight;
    }

    public static void assertCorrectPlatform() throws RuntimeException {
        try {
            // assert that avutil is loaded
            Loader.load(org.bytedeco.ffmpeg.global.avutil.class);
        } catch (Throwable ee) {
            UI.errorDialog.show();
            throw new RuntimeException(ee);
        }
    }


    public static void selectFile(Fi file) throws Exception {

        try {
            FFmpegFrameGrabber fFmpegFrameGrabber = new FFmpegFrameGrabber(file.absolutePath());
            fFmpegFrameGrabber.start();
            mediaFrameCount = fFmpegFrameGrabber.getLengthInFrames();
            mediaWidth = fFmpegFrameGrabber.getImageWidth();
            mediaHeight = fFmpegFrameGrabber.getImageHeight();
        } catch (Exception e) {
            selectedFile = null;
            ModVars.infoTag(e);
            throw new Exception("Invalid file!");
        }
        selectedFile = file;
    }

    public static void addThread(MediaProcessThread thread) {
        threads.add(thread);
    }

    public static Fi getSelectedFile() {
        return selectedFile;
    }

    public static List<MediaProcessThread> getThreads() {
        return threads;
    }

    public static void init() {
        Core.app.addListener(new ApplicationListener() {
            @Override
            public void dispose() {
                for (ProcessThread thread : threads) {
                    thread.shutdown();
                }
            }
        });
    }


    public static boolean isImage () throws IllegalArgumentException {
        List<String> imageExtensions = Arrays.asList(
                ".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif", ".webp", ".svg", ".heic", ".ico", ".raw"
        );

        List<String> videoExtensions = Arrays.asList(
                ".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".webm", ".m4v", ".3gp", ".ogg", ".ogv", ".mts", ".m2ts", ".ts"
        );

        String lowerCaseFilePath = selectedFile.path().toLowerCase();
        if (imageExtensions.stream().anyMatch(lowerCaseFilePath::endsWith)) {
            return true;
        } else if (videoExtensions.stream().anyMatch(lowerCaseFilePath::endsWith)) {
            return false;
        } else {
            throw new IllegalArgumentException("File is not an image or video");
        }
    }
}