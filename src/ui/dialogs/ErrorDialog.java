package ui.dialogs;

import arc.*;
import arc.util.*;
import mindustry.ui.dialogs.*;

public class ErrorDialog extends BaseDialog {
    public ErrorDialog(String title) {
        super(title);

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

        addCloseButton();
        cont.add(text).pad(10).row();
        cont.button("Github", () -> Core.app.openURI("https://github.com/ElectricGun/video-to-logic/releases")).width(200).pad(30).row();
        show();
    }
}
