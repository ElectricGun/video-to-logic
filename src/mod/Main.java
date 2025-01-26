package mod;

import arc.*;
import arc.scene.ui.Dialog;
import arc.util.OS;
import org.bytedeco.javacpp.Loader;
import resources.Dialogs;
import mindustry.game.EventType.*;
import mindustry.mod.*;
import resources.ModVars;
import resources.SessionData;
import ui.UI;

import java.awt.*;
import java.net.URI;

public class Main extends Mod {

    public Main() {
        Events.on(ClientLoadEvent.class, e -> {
            Dialogs.load();
            UI.setupUI();

            try {
                // assert that avutil is loaded
                Loader.load(org.bytedeco.ffmpeg.global.avutil.class);
            } catch (Throwable ee) {
                Dialog dialog = new Dialog("@video-to-logic-unsupported");
                String text;

                 if (OS.isLinux) {
                    text = "This version of Video to Logic is not supported on your device\nPlease install the[green] Linux [white]or [green]Platform [white]version in the Github repository.";
                } else if (OS.isWindows) {
                    text = "This version of Video to Logic is not supported on your device\nPlease install the [green]Windows [white]or [green]Platform [white]version in the Github repository.";
                } else if  (OS.isMac) {
                    text = "This version of Video to Logic is not supported on your device\nPlease install the [green]Mac [white]or [green]Platform [white]version in the Github repository.";
                } else {
                    text = "Video to Logic is not supported on your device\nPlease use a Desktop computer, or try the [green]Platform [white]version of the mod [NOT GUARANTEED TO WORK]";
                }

                text += "\nOtherwise, [red]disable this mod.";

                dialog.cont.add(text).pad(10).row();
                dialog.cont.button("Github", () -> Core.app.openURI("https://github.com/ElectricGun/video-to-logic/releases")).width(200).pad(30).row();
                dialog.cont.button("Cancel", dialog::hide).width(200).bottom().pad(10);
                dialog.show();
            }
        });
    }

    @Override
    public void loadContent() {
        SessionData.init();
        ModVars.load();
        ModVars.infoTag("OpenCV version: " + org.opencv.core.Core.VERSION);
    }
}