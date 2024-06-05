import chalk from 'chalk';

export default class Log {
    constructor(module) {
        this.module = module.substring(0, 20);
    }
    
    log(level, msg) {
        let levelText;
        switch(level) {
            case 'error':
                levelText = chalk.red('[Error]');
                break;
            case 'warn':
                levelText = chalk.yellow('[Warn] ');
                break;
            default:
                levelText = chalk.green('[Info] ');
                break;
        }
        console.log(
            new Date().toLocaleString() +
            ' ' +
            levelText +
            ' ' +
            chalk.blue('[' + this.module + ']') +
            ' '.repeat(20 - this.module.length + 1) +
            msg
        );
    }
    
    error(msg) {
        this.log('error', msg);
    }
    
    warn(msg) {
        this.log('warn', msg);
    }
    
    info(msg) {
        this.log('info', msg);
    }
}