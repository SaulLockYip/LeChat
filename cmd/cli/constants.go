package main

const (
	// Protocol version
	ProtocolVersion = "1.0"

	// Socket message types
	MessageTypeServerStop    = "server_stop"
	MessageTypeServerStopAck = "server_stop_ack"
	MessageTypeMessageSend   = "message_send"
	MessageTypeResponse      = "response"
	MessageTypeError         = "error"
)
