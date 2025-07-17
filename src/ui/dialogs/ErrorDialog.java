package ui.dialogs;

import arc.*;
import arc.util.*;
import mindustry.ui.dialogs.*;

public class ErrorDialog extends BaseDialog {
    public ErrorDialog(String title) {
        super(title);

        String text =
        """
        This version of Video to Logic is not supported on your device
        Please install the[green] %s [white]or [green]Platform [white]version in the Github repository.
        Android is NOT supported!
        """;

        if (OS.isLinux) {
            text = String.format(text, "Linux");
        } else if (OS.isWindows) {
            text = String.format(text, "Windows");
        } else if  (OS.isMac) {
            text = String.format(text, "Mac");
        } else {
            text = """
        Video to Logic is not supported on your device
        Please use a Desktop computer
        Android is NOT supported!
        """;
        }

        text += "\nOtherwise, [red]disable this mod.";

        addCloseButton();
        cont.add(text).pad(10).row();
        cont.button("Github", () -> Core.app.openURI("https://github.com/ElectricGun/video-to-logic/releases")).width(200).pad(30).row();
        show();
    }
}
