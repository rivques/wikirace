
# Import Module
import socket

# Create a socket object
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# connect to the server on local computer
s.connect(("8.8.8.8", 80))

# Print Output
print("HostName: ",s.getsockname()[0])
s.close()