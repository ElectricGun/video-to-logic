package mod;

import arc.*;
import arc.scene.ui.Dialog;
import arc.util.OS;
import mindustry.ui.dialogs.BaseDialog;
import org.bytedeco.javacpp.Loader;
import resources.Dialogs;
import mindustry.game.EventType.*;
import mindustry.mod.*;
import resources.ModVars;
import resources.SessionData;
import ui.UI;

import static resources.SessionData.assertCorrectPlatform;

public class Main extends Mod {
    public Main() {
        Events.on(ClientLoadEvent.class, e -> {
            Dialogs.load();
            UI.setupUI();

            try {
                assertCorrectPlatform();
            } catch (Exception ee) {
                ModVars.infoTag(ee);
            }
        });
    }

    @Override
    public void loadContent() {
        SessionData.init();
        ModVars.infoTag("OpenCV version: " + org.opencv.core.Core.VERSION);
    }
}