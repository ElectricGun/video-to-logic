# sequence-to-logic
Converts video sequence to a Mindustry logic display animation <br> <br>
## How to use:
0. Use the [video converter script](https://github.com/ElectricGun/video-converter "Video Converter") to convert a video into a bunch of files (or create your own script, output format must be the same)<br>
1. Install electricgun/message-block-commands <br>
2. Copy the output folder of the video converter to the animations folder in the mod directory. You might need to unzip the mod first <br>
3. Place down a message block on a Sandbox World <br>
4. Type "/v2logic args= (medianame), (compression)" where (medianame) is the name of your sequence folder in the animations folder and (compression) is how compressed the output will be <br>
5. Exit out of the message block gui. <br>
6. Wait for it to finish, it will lag, building the processors might take a while. This depends on your CPU and the size of the sequence <br>
7. Exit the world and rejoin to refresh the processors <br>
8. Activate the switch to play. <br> <br>
## Important: 
- If your animation is very crusty and choppy, you may need to decrease the compression treshold or artifically increase the hyperprocessor speed using Blocks.hyperProcessor.instructionsPerTick = (number, larger than 25) <br>
- The processors will overwrite blocks in a roughly 42 block radius, only use this mod on disposable sandbox worlds, you can then save it as a scheme after
- Config file directory: data/config.hjson
