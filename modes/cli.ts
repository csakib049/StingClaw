import chalk from "chalk";
import { select , isCancel } from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";
import { runPlanMode } from "./plan/orchestrator";
import { runTaskCenter } from "./agent/task-center";


export async function runCliMode( ) {
    while(true){
      const mode = await select({
        message:"Choose CLI sub-mode",
        options:[
            {value:"agent",label:"Agent Mode"},
            {value:"plan",label:"plan Mode"},
            {value:"ask",label:"Ask Mode"},
            {value:"tasks",label:"Task Center"},
            {value:"back",label:"←-- Back to main manu"},
        ],
      });


      if(isCancel(mode) || mode === "back") return;

      if(mode === "agent"){
        await runAgentMode()
      }
      if(mode === "plan"){
        await runPlanMode()
      }
      if(mode === "ask"){
        await runAskMode()
      }
      if(mode === "tasks"){
        await runTaskCenter()
      }

        if(mode !== 'agent' && mode !=='ask' && mode!='plan' && mode!='tasks'){
            console.log(chalk.yellow("\nThat mode is not implemented yet. \n"))
        }


    }
}
