```
  Usage: wio [command]


  Commands:

    add [-v]          Add new user for tracking
    run [-vf]         Runs the script to check who is online specified in log file
    log [-v]  <path>  Sets absolute path to file to be logged

  Options:

    -h, --help     output usage information
    -v, --verbose
    -f, --force    Force AngryIpScan before matching MAC to IP. Requires sudo to flush the arp table
```

### Usage
- Create a log file and use `wio log <path>` to let the script know where it should log.
- Use `wio add` to add username/MAC address key value pair to be tracked
- Run the script with `wio run -v` to log the saved MAC addresses. You might want to run `sudo wio run -vf` to forcefully delete and update the arp table

<hr>

Thank you [@jetpeter](https://github.com/jetpeter) and [@alex-cs](https://github.com/alex-cs) for contributing and co-founding the idea.
