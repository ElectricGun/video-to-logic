package ui;

import arc.*;
import arc.scene.style.*;
import arc.scene.ui.layout.*;
import resources.*;
import ui.dialogs.*;

import static resources.Dialogs.*;


import static mindustry.Vars.ui;

public class UI {
    public static ErrorDialog errorDialog;

    public static void setupUI()  {

        setupButtons();
        errorDialog = new ErrorDialog("@video-to-logic-unsupported");

    }

    private static void setupButtons() {
        Table statusTable = ui.hudGroup.find("statustable");
        statusTable.row();

        Table table = new Table() {{
            name = "menutable";
        }};

        statusTable.add(table).bottom().left();

        table.table(t -> {


            // unhardcode later
            int size = 80;

            t.button(new TextureRegionDrawable(Core.atlas.find("video-to-logic-java-frog")), size, () -> {

            }).size(size);

            t.clicked(() -> {
                try {
                    SessionData.assertCorrectPlatform();
                    testDialog.show();
                } catch (Exception e) {
                    UI.errorDialog.show();
                }
            });
        });
    }
}
