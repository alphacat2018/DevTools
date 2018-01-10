on run argv
  tell application "iTerm"
    activate
    set hasNoWindows to ((count of windows) is 0)
    if hasNoWindows then
      create window with default profile
    end if
    select first window

    set command to "clear; cd " & item 1 of argv

    tell the first window
      if hasNoWindows is false then
        create tab with default profile
      end if
      tell current session to write text command
    end tell
  end tell
end run