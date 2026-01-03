#!/usr/bin/env python3
import sys

# Read the file
with open('chess_engine.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find </script> and insert }); before it
if '  </script>' in content:
    content = content.replace('    }\n  </script>', '    }\n  }); // Close $(document).ready()\n  </script>', 1)
    
    # Write back
    with open('chess_engine.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully added closing }); before </script>")
else:
    print("Could not find </script> tag")
    sys.exit(1)
