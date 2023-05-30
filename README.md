# sequence-to-mindustry-logic
Converts video sequence to a Mindustry logic display animation <br> <br>
## How to use:
0. Use the video to sequence script to convert a video into a bunch of files <br>
1. Install electricgun/message-block-commands <br>
2. Place down a message block on a Sandbox World <br>
3. Type "/v2logic args= <medianame>, <compression>" where <medianame> is the name of your sequence folder and <compression> is how compressed the output will be <br>
4. Exit out of the message block gui. <br>
5. Wait, building the processors might take a while. This depends on your CPU and the size of the sequence <br>
6. Exit the world and rejoin to refresh the processors <br>
7. Activate the switch to play. <br> <br>
  
Note: if your animation is very crusty and choppy, you may need to decrease the compression treshold or artifically increase the hyperprocessor speed using Blocks.hyperProcessor.instructionsPerTick = <number, larger than 25>
