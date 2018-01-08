on run argv

set p to item 1 of argv & "/" & item 2 of argv

-- tell application "Finder"
--     reopen
--     activate
--     set target of window 1 to (POSIX file p as text)
-- end tell

tell application "Finder"
    reveal POSIX file p as text
    activate
end tell

end run