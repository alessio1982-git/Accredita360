const fs = require('fs');
const readline = require('readline');

async function searchLogs() {
    const logsPath = 'C:\\Users\\siapa\\.gemini\\antigravity-ide\\brain\\671525ed-e08f-4635-b461-48bbbad9b5e8\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(logsPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        try {
            const data = JSON.parse(line);
            if (data.tool_calls) {
                for (const call of data.tool_calls) {
                    if (call.name === 'run_command') {
                        let cmd = call.args?.CommandLine || '';
                        if (cmd.startsWith('"') && cmd.endsWith('"')) {
                            try { cmd = JSON.parse(cmd); } catch(e) {}
                        }
                        console.log(`Step ${data.step_index}: ${cmd}`);
                    }
                }
            }
        } catch (e) {}
    }
}

searchLogs();
