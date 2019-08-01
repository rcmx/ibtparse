const readline = require('readline');
import * as program from 'commander';
import { IbtParser } from './ibtParser';


async function main() {
	program
		.option('-f, --file <ibtFileName>', 'path to ibt file');

	program.parse(process.argv);

	if (!program.file) {
		console.log(program.help());
		return;
	}

	const parser = new IbtParser(program.file);
	const data = await parser.parse();


	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: 'var ?> '
	});

	rl.prompt();

	rl.on('line', (line: any) => {

		const val = parser.getVarValue(line);
		if (val == -1) {
			console.log('not found');
		} else
		console.log(val);

		rl.prompt();
	}).on('close', () => {
		console.log('Have a great day!');
		process.exit(0);
	});

	//	console.log(JSON.stringify(data, null, 2));
}



main();
