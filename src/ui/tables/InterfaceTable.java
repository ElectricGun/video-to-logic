package ui.tables;

import arc.func.*;
import arc.math.geom.*;
import arc.scene.ui.*;
import arc.scene.ui.layout.*;
import datatypes.configs.*;
import mindustry.*;
import mindustry.content.*;
import mindustry.gen.*;
import mindustry.ui.*;
import mindustry.world.*;
import resources.*;
import java.util.*;

import static resources.Processes.*;
import static resources.SessionData.*;

public class InterfaceTable extends BaseTable {

    protected String
        kFrameStart = "frame-start",
        kFrameEnd = "frame-end",
        kTolerance = "tolerance",
        kMinPixelSize = "min-pixel-size",
        kFrameStep = "frame-step",
        kPixelStepX = "pixel-step-x",
        kPixelStepY = "pixel-step-y",
        kMaxThreads = "max-threads",
        kNewSizeX = "new-size-x",
        kNewSizeY = "new-size-y",
        kProcessors = "processors"
                ;

    // Input fields. Uses a map for ease of scalability
    protected Map<String, TextField> inputFieldMap = new HashMap<>();
    protected Map<String, Button> stateFieldsMap = new HashMap<>();

    // Save the values because the table refreshes a lot
    protected Map<String, String> inputFieldValues = new HashMap<>();
    // todo
    protected Map<String, String> inputFieldDefaultValues = new HashMap<>();
    protected boolean isImage = false;

    protected final Block[] processors = new Block[]{Blocks.microProcessor, Blocks.worldProcessor};

    public void setInputFieldValue(String textFieldKey, String textFieldValue) throws IllegalArgumentException {
        if (!inputFieldMap.containsKey(textFieldKey)) throw new IllegalArgumentException("Text field" + textFieldKey + " does not exist!");

        inputFieldValues.put(textFieldKey, textFieldValue);
        inputFieldMap.get(textFieldKey).setText(textFieldValue);
    }

    public String getInputFieldStringVisual(String textFieldKey) throws IllegalArgumentException {
        if (!inputFieldMap.containsKey(textFieldKey)) throw new IllegalArgumentException("Text field" + textFieldKey + " does not exist!");
        return inputFieldMap.get(textFieldKey).getText();
    }

    public void refreshInputFieldsVisual() {
        for (String key : inputFieldMap.keySet()) {
            inputFieldMap.get(key).setText(inputFieldValues.get(key));
        }
    }

    protected Cell<Table> newInputField(String key, Table element, String labelName,int labelWidth, int labelHeight) {
        TextField textField = new TextField();

        inputFieldMap.put(key, textField);

        if (!inputFieldValues.containsKey(key))
            inputFieldValues.put(key, "0");
        else
            textField.setText(inputFieldValues.get(key));

        return element.table(t -> {
            t.add(new Label(labelName)).left().width(labelWidth).height(labelHeight);
            t.add(textField).left().growX().height(labelHeight);
            t.setBackground(Tex.button);
        });
    }

    public Cell<Table> newIntInputField(String key, Table element, String labelName,int labelWidth, int labelHeight, int minValue, int maxValue) {
        Cell<Table> inputField = newInputField(key, element, labelName,labelWidth, labelHeight);
        TextField textField = inputFieldMap.get(key);

        textField.setFilter((t, input) -> Character.isDigit(input));

        textField.update(() -> {
            String input = textField.getText();
            if (!input.isEmpty()) {
                try {
                    int value = Integer.parseInt(input);

                    if (value < minValue) {
                        setInputFieldValue(key, String.valueOf(minValue));
                    } else if(value > maxValue) {
                        setInputFieldValue(key, String.valueOf(maxValue));
                    }

                    inputFieldValues.put(key, String.valueOf(value));

                } catch (NumberFormatException e) {
                    textField.setText(String.valueOf(minValue));
                }
            } else {
                setInputFieldValue(key, String.valueOf(minValue));
            }
        });
        return inputField;
    }

    protected Cell<Table> newStatesField(String key, Table element, String labelName, Prov<CharSequence> labelProv, int labelWidth, int labelHeight, int maxValue ) {
        Button button = new Button();
        Label label = new Label(labelProv);
        button.add(label);

        stateFieldsMap.put(key, button);

        if (!inputFieldValues.containsKey(key))
            inputFieldValues.put(key, "0");

        button.clicked(() -> {
            int inputValue = ((int) Float.parseFloat(inputFieldValues.get(key))) + 1;
            if (inputValue > maxValue) {
                inputValue = 0;
            }
            ModVars.infoTag(maxValue);
            inputFieldValues.put(key, String.valueOf(inputValue));
        });

        return element.table(t -> {
            t.add(new Label(labelName)).left().width(labelWidth).height(labelHeight);
            t.add(button).left().growX().height(labelHeight);
            t.setBackground(Tex.button);
        });
    }

    public void resetToDefaults() {
        inputFieldValues.put(kFrameStart, "0");
        inputFieldValues.put(kTolerance, "0.1");
        inputFieldValues.put(kFrameEnd, String.valueOf(getMediaFrameCount()));
        inputFieldValues.put(kNewSizeX, String.valueOf(getMediaWidth()));
        inputFieldValues.put(kNewSizeY, String.valueOf(getMediaHeight()));
    }

    public Cell<Table> newFloatInputField(String key, Table element, String labelName,int labelWidth, int labelHeight, float minValue, float maxValue) {
        Cell<Table> inputField = newInputField(key, element, labelName,labelWidth, labelHeight);
        TextField textField = inputFieldMap.get(key);

        textField.setFilter((t, input) -> {
            String currentText = t.getText();
            return Character.isDigit(input) ||
                    input == '.' && !currentText.contains(".") ||
                    input == '-' && currentText.isEmpty();
        });

        textField.update(() -> {
            String input = textField.getText();
            if (!input.isEmpty()) {
                try {
                    float value = Float.parseFloat(input);

                    if (value < minValue) {
                        setInputFieldValue(key, String.valueOf(minValue));
                    } else if(value > maxValue) {
                        setInputFieldValue(key, String.valueOf(maxValue));
                    }

                    inputFieldValues.put(key, String.valueOf(value));
                } catch (NumberFormatException e) {
                    textField.setText(String.valueOf(minValue));
                }
            } else {
                setInputFieldValue(key, String.valueOf(minValue));
            }
        });
        return inputField;
    }


    public void build() {
        clear();

        Table mainInterfaceTable = new Table(Styles.none);
        ScrollPane interfaceScrollpane = new ScrollPane(mainInterfaceTable);
        Table topInterfaceTable = new Table(Styles.none);

        TextButton openFileButton = new TextButton("Open File");
        TextButton resetButton = new TextButton("Reset");
        TextButton executeButton = new TextButton("Execute");
        Label label = new Label("");
        label.setWrap(true);

        openFileButton.clicked(() -> {
            Vars.platform.showFileChooser(true, "*", file -> {
                if (file != null) {
                    try {
                        selectFile(file);
                        isImage = SessionData.isImage();
                        resetToDefaults();
                    } catch (Exception e) {
                        ModVars.infoTag(e);
                    }
                    runnableOnUpdate.run();
                    build();
                }
            });
        });

        if (getSelectedFile() != null) {
            label.setText(getSelectedFile().absolutePath());
        }

        resetButton.clicked(() -> {
            resetToDefaults();
            build();
        });

        initMainInterfaceTable(mainInterfaceTable);

        executeButton.clicked(() -> {
            refreshInputFieldsVisual();
            ModVars.infoTag("Created new process for " + getSelectedFile().absolutePath());

            int frameStart = 0; int frameEnd = 0; int frameStep = 1;
            if (!isImage) {
                setInputFieldValue(kFrameEnd, String.valueOf(Math.max((int) Float.parseFloat(inputFieldValues.get(kFrameStart)), (int) Float.parseFloat(inputFieldValues.get(kFrameEnd)))));
                frameStart = (int) Float.parseFloat(inputFieldValues.get(kFrameStart));
                frameEnd = (int) Float.parseFloat(inputFieldValues.get(kFrameEnd));
                frameStep = (int) Float.parseFloat((inputFieldValues.get(kFrameStep)));
            }

            MediaProcessConfig frameConfig = new MediaProcessConfig(frameStart, frameEnd);
            frameConfig.tolerance = Float.parseFloat(inputFieldValues.get(kTolerance));
            frameConfig.minPixelSize = (int) Float.parseFloat(inputFieldValues.get(kMinPixelSize));
            frameConfig.frameStep = frameStep;
            frameConfig.maxThreads = (int) Float.parseFloat(inputFieldValues.get(kMaxThreads));
            frameConfig.pixelStep = new Vec2(
                    (int) Float.parseFloat((inputFieldValues.get(kPixelStepX))),
                    (int) Float.parseFloat((inputFieldValues.get(kPixelStepY))));
            frameConfig.newSize = new Vec2(
                    (int) Float.parseFloat((inputFieldValues.get(kNewSizeX))),
                    (int) Float.parseFloat((inputFieldValues.get(kNewSizeY))));
            frameConfig.isImage = isImage;
            frameConfig.processor = processors[(int) Float.parseFloat(inputFieldValues.get(kProcessors))];

            ModVars.infoTag(frameConfig);
            runProcessVideoThread(getSelectedFile().absolutePath(), frameConfig);
            runnableOnUpdate.run();
            build();
        });

        if (getSelectedFile() != null)
            add(topInterfaceTable).growX().top().left().row();
        else
            add(topInterfaceTable).grow().center().row();

        topInterfaceTable.add(openFileButton).width(400).height(50).pad(10);

        if (getSelectedFile() != null) {
            topInterfaceTable.add(label).growX().center().left().pad(10).row();

            add(interfaceScrollpane).left().growY().row();
            mainInterfaceTable.top().left();

            table(t -> {
                t.add(resetButton).width(400).height(50).bottom().left().pad(10).row();
                t.add(executeButton).width(400).height(50).bottom().left().pad(10).row();
            }).bottom().right().row();
        }

        refreshInputFieldsVisual();
    }

    protected void initMainInterfaceTable(Table mainInterfaceTable) {
        if (!isImage) {
            newIntInputField(kFrameStart, mainInterfaceTable, "Start", 200, 50, 0, getMediaFrameCount()).left().width(400).pad(10).row();
            newIntInputField(kFrameEnd, mainInterfaceTable, "End", 200, 50, 0, getMediaFrameCount()).left().width(400).pad(10).row();
            newIntInputField(kFrameStep, mainInterfaceTable, "Frame Step", 200, 50, 1, getMediaFrameCount()).left().width(400).pad(10).row();
        }
        newIntInputField(kNewSizeX, mainInterfaceTable, "New Size X",200, 50, 1, 25600).left().width(400).pad(10).row();
        newIntInputField(kNewSizeY, mainInterfaceTable, "New Size Y",200, 50, 1, 25600).left().width(400).pad(10).row();
        newFloatInputField(kTolerance, mainInterfaceTable, "Tolerance", 200, 50, 0, 1f).left().width(400).pad(10).row();
        newIntInputField(kMinPixelSize, mainInterfaceTable, "MinPixelSize",200, 50, 1, Math.max(getMediaWidth(), getMediaHeight())).left().width(400).pad(10).row();
        newIntInputField(kPixelStepX, mainInterfaceTable, "Pixel Step X",200, 50, 1, getMediaWidth()).left().width(400).pad(10).row();
        newIntInputField(kPixelStepY, mainInterfaceTable, "Pixel Step Y",200, 50, 1, getMediaHeight()).left().width(400).pad(10).row();
        newIntInputField(kMaxThreads, mainInterfaceTable, "Max Threads",200, 50, 1, 128).left().width(400).pad(10).row();
        Prov<CharSequence> prov;

        prov = () ->
        {
            try {
                return processors[(int) Float.parseFloat(inputFieldValues.get(kProcessors))].toString();
            } catch (Exception e) {
                return "";
            }
        };

        newStatesField(kProcessors, mainInterfaceTable, "Processors",prov, 200, 50, processors.length - 1).left().width(400).pad(10).row();
    }
}
