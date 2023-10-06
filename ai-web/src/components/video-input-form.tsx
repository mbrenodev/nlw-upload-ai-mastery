import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = 'waiting' | 'converting' | 'uploading' |'generating' | 'success'

interface VideoInputFormProps {
  onVideoUploaded: (id: string) => void
}

const statusMessages = {
  converting: 'Convertendo...',
  generating: 'Transcrevendo...',
  uploading: 'Carregando...',
  success: 'Sucesso!'

}

export function VideoInputForm(props: VideoInputFormProps) {
  const [videoFile, setVideoFIle] = useState<File | null>(null)
  const promptInputRef = useRef<HTMLInputElement>(null)
  const [status,setStatus] = useState<Status>('waiting')


  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {

    const { files } = event.currentTarget

    if(!files) {
      return
    }

    const selectedFile = files[0]
    setVideoFIle(selectedFile)

  }


  async function convertVideoToAudio(video: File) {
    console.log('Convert starded.')

    const ffmepg = await getFFmpeg()

    await ffmepg.writeFile('input.mp4', await fetchFile(video))

    // ffmepg.on("log", log => {
    //   console.log(log)
    // })

    ffmepg.on("progress", progress => {
      console.log('Convert Progess:' + Math.round(progress.progress * 100))
    })

    await ffmepg.exec([
      '-i',
      'input.mp4',
      '-map',
      '0:a', 
      '-b:a',
      '20k',
      '-acodec',
      'libmp3lame',
      'output.mp3',
    ])

    const data = await ffmepg.readFile('output.mp3')

    const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
    const audioFile = new File([audioFileBlob], 'audio.mp3', {
      type: 'audio/mpeg',
    })

    console.log('Convert finished')
    
    return audioFile
  }


  async function handleUploadVideo(event: FormEvent<HTMLFormElement>){
    event.preventDefault()

    const prompt = promptInputRef.current?.value

    if(!videoFile){
      return
    }

    setStatus('converting')
    
    const audioFile = await convertVideoToAudio(videoFile)
    const data = new FormData()
    data.append('file', audioFile)

    setStatus('uploading')

    const response = await api.post('/videos', data)
    
    const videoId = response.data.video.id

    setStatus('generating')

    await api.post(`/videos/${videoId}/transcription`, {
      prompt
    })

    setStatus("success")

    props.onVideoUploaded(videoId)

  }

  const previewURL = useMemo(() => {
    if(!videoFile){
      return null
    }

    return URL.createObjectURL(videoFile)      
  }, [videoFile])


  return (
    <form onSubmit={handleUploadVideo} className='space-y-6'>
    <label 
      htmlFor="video"
      className='relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5'
    >
      {previewURL ? (
        <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0" />
      ) : (
        <>
          <FileVideo className='w-4 h-4'/>
          Selecione um video
        </>
      )}
    </label>

    <input type="file" id='video' accept='video/mp4' className='sr-only' onChange={handleFileSelect} />

    <Separator />

    <div className='space-y-2'>
      <Label htmlFor='transcription_prompt'>Prompt de transcrição</Label>
      <Textarea 
        ref={promptInputRef}
        disabled={status !== 'waiting'}
        id='transcription_prompt' 
        className='h-20 leading-relaxed resize-none'
        placeholder='Inclua palavras-chave mencionadas no video separadas por vírgula (,)' 
      />
    </div>

    <Button 
      data-success={status === 'success'}
      disabled={status !== 'waiting'} 
      type='submit' 
      className='w-full data-[success=true]:bg-emerald-400'
    >
      {status === 'waiting' ? (
        <>
          Carregar vídeo 
          <Upload className='w-4 h-4 ml-2' /> 
        </>
      ) : statusMessages[status]}
    </Button>
  </form>
  )
}