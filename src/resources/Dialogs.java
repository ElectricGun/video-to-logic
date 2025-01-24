package resources;

import ui.dialogs.MainDialog;

public class Dialogs {
    public static MainDialog testDialog;

    public static void load() {
        testDialog = new MainDialog("@video-to-logic-dialog-main");
    }
}
