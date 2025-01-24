package mod;

import arc.*;
import resources.Dialogs;
import mindustry.game.EventType.*;
import mindustry.mod.*;
import resources.ModVars;
import resources.SessionData;
import ui.UI;

public class Main extends Mod {


    public Main() {
        Events.on(ClientLoadEvent.class, e -> {
            Dialogs.load();
            UI.setupUI();
        });
    }

    @Override
    public void loadContent() {
        SessionData.init();
        ModVars.load();
        ModVars.infoTag("OpenCV version: " + org.opencv.core.Core.VERSION);
    }
}