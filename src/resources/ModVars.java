package resources;

import arc.util.*;
import arc.util.serialization.*;

import java.io.*;

public class ModVars {
    public static String displayName, name, author, description, version, minGameVersion;
    public static void infoTag(Object object) {
        Log.infoTag(name, String.valueOf(object));
    }

    static {
        try {
            InputStream modJsonStream = ModVars.class.getClassLoader().getResourceAsStream("mod.hjson");

            if (modJsonStream != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(modJsonStream));
                StringBuilder jsonContent = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    jsonContent.append(line).append("\n");
                }
                reader.close();

                JsonReader jsonReader = new JsonReader();
                JsonValue json = jsonReader.parse(String.valueOf(Jval.read(jsonContent.toString().toString())));

                displayName = json.getString("displayName", "Unknown");
                name = json.getString("name", "Unknown");
                author = json.getString("author", "Unknown");
                description = json.getString("description", "Unknown");
                version = json.getString("version", "Unknown");
                minGameVersion = json.getString("minGameVersion", "Unknown");

            }

        } catch (Exception e) {
            ModVars.infoTag(String.valueOf(e));
        }
    }
}
