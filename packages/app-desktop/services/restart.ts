import Setting from '@joplin/lib/models/Setting';
import bridge from './bridge';


export default async (linuxSafeRestart: boolean = true) => {
	Setting.setValue('wasClosedSuccessfully', true);
	await Setting.saveAll();

	bridge().restart(linuxSafeRestart);
};
