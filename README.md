# sequence-to-logic
Converts video sequence to a Mindustry logic display animation <br> <br>
## How to use:
0. Use the [video converter script](https://github.com/ElectricGun/video-converter "Video Converter") to convert a video into a bunch of files (or create your own script, output format must be the same) <br> <br>
1. Install electricgun/message-block-commands <br> <br>
2. Copy the output folder of the video converter to the animations folder in the mod directory. You might need to unzip the mod folder first <br> <br>
3. Place down a message block on a Sandbox World <br> <br>
4. Type "/v2logic args= (medianame), (maxCol), (processorType)" into it, where <br>(medianame) is the name of your sequence folder in the animations folder, <br> (maxCol) is the max number of "draw color"s per adjacent colours. Higher values lead to a smaller scheme size, <br> (processorType) is the type of the processors (in camelcase e.g. worldProcessor) <br>  <br>Example command: /v2logic args=amongUs,255, hyperProcessor. This will render the sequence "amongUs" with a maximum of 255 draw calls without a "draw color" call using Hyper Processors. <br> <br>
5. Exit out of the message block gui. <br> <br>
6. Wait for it to finish, it will lag, building the processors might take a while depending on your CPU and the overall size of the sequence <br> <br>
7. Exit the world and rejoin to refresh the processors <br> <br>
8. Activate the switch to play. <br> <br> <br>
## Important: 
- If your animation is very crusty and choppy, you may need to decrease the compression treshold or artifically increase the hyperprocessor speed using Blocks.hyperProcessor.instructionsPerTick = (number, larger than 25) <br> <br>
- The processors will overwrite blocks in a roughly 42 block radius, only use this mod on disposable sandbox worlds, you can then save it as a scheme after <br> <br>
- Config file directory: data/config.hjson <br>
<br>
ONLY USE ON DISPOSABLE SANDBOX WORLDS, unless you want your builds overwritten by processors.
