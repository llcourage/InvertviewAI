# Protocol Buffer Definitions

This folder contains Protocol Buffer (protobuf) message definitions for the Interview AI application.

## Files

- `interview.proto` - Main interview message definitions

## Message Types

### InterviewMessage
Represents a single message in the conversation with role, content, and timestamp.

### InterviewRequest
Request to send messages to the interview API with interview type and first message flag.

### InterviewResponse
Response from the interview API with the assistant's message and usage information.

### SpeechToTextRequest/Response
Request and response for speech-to-text conversion using Whisper.

### TextToSpeechRequest/Response
Request and response for text-to-speech conversion using OpenAI TTS.

### CallState
Represents the current state of the voice call (status, text, mute state).

## Usage

These proto definitions can be used to:
- Generate type-safe client/server code
- Ensure consistent message formats
- Enable future gRPC support

## Compilation

To compile proto files (if using protobuf):

```bash
protoc --js_out=import_style=commonjs,binary:. proto/interview.proto
```

Or for TypeScript:

```bash
npm install -g ts-proto
protoc --ts_proto_out=. proto/interview.proto
```










