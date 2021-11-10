import {
  render,
  ActionPanel,
  SubmitFormAction,
  PushAction,
  Color,
  Icon,
  List,
  Detail,
  Form,
  FormValues,
  OpenInBrowserAction,
  preferences,
  showToast,
  ToastStyle,
  useNavigation,
  setLocalStorageItem,
  getLocalStorageItem,
} from '@raycast/api'
import { useEffect, useState } from 'react'
import {
  Database,
  DatabasePropertie,
  Page,
  fetchDatabases,
  fetchDatabaseProperties,
  createDatabasePage,
} from './notion'



export default function CreateDatabaseForm(): JSX.Element {
  // Get preference values
  const notion_token = String(preferences.notion_token.value)
  const notion_workspace_slug = String(preferences.notion_workspace_slug.value)
  if (notion_token.length !== 50) {
    showToast(ToastStyle.Failure, 'Invalid token detected')
    throw new Error('Invalid token length detected')
  }

  // On form submit function
  const { pop } = useNavigation();
  async function handleSubmit(values: FormValues) {
    if (!validateForm(values)) {
      return;
    }

    setIsLoading(true)
    const page = await createDatabasePage(values)
    setIsLoading(false)
    if(!page){
      showToast(ToastStyle.Failure, 'Couldn\'t create database page');
    }else{
      showToast(ToastStyle.Success, 'Page created!');
      pop();
    }
  }

  // Setup useState objects
  const [databases, setDatabases] = useState<Database[]>()
  const [databaseProperties, setDatabaseProperties] = useState<DatabasePropertie[]>()  
  const [databaseId, setDatabaseId] = useState<string>()
  const [isLoading, setIsLoading] = useState<boolean>(true)

  
  // Fetch databases
  useEffect(() => {
    const fetchData = async () => {

      const cachedDatabases = await loadDatabases()

      if (cachedDatabases) {
        setDatabases(cachedDatabases)
      }

      const fetchedDatabases = await fetchDatabases()
      
      
      setDatabases(fetchedDatabases)
      setIsLoading(false)

      await storeDatabases(fetchedDatabases)
            
     
    }
    fetchData()
  }, [])

  // Fetch selected database property
  useEffect(() => {
    const fetchData = async () => {
      if(databaseId){
        setIsLoading(true)

        const cachedDatabaseProperties = await loadDatabaseProperties(databaseId)

        if (cachedDatabaseProperties) {
          setDatabaseProperties(cachedDatabaseProperties)
        }

        const fetchedDatabaseProperties = await fetchDatabaseProperties(databaseId)
      
        setDatabaseProperties(fetchedDatabaseProperties)          
        setIsLoading(false)

        await storeDatabaseProperties(databaseId, fetchedDatabaseProperties)
        
      }      
    }
    fetchData()
  }, [databaseId])


  if(databases && !databases[0]){
    return NoSharedContent()
  }
  return (
    <Form 
      isLoading={isLoading} 
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <SubmitFormAction 
              title='Create Page'
              icon={Icon.Plus}
              onSubmit={handleSubmit}
               />
            </ActionPanel.Section>
        </ActionPanel>
      }>
      <Form.Dropdown 
        key='database'
        id='database'
        title={'Database'}
        onChange={setDatabaseId}
        storeValue>
          {databases?.map((d) => {
            return (
              <Form.Dropdown.Item
                key={d.id} 
                value={d.id} 
                title={(d.title ? d.title : 'Untitled') }
                icon={((d.icon_emoji) ? d.icon_emoji : ( d.icon_file ?  d.icon_file :  ( d.icon_external ?  d.icon_external : Icon.TextDocument))) } />
            )
          })}
      </Form.Dropdown>
      <Form.Separator />
      {databaseProperties?.map((dp) => {
        const key = 'property::'+dp.type+'::'+dp.id;
        const id = key;
        const title = dp.name;
        var placeholder = dp.type.replace(/_/g, ' ');
        placeholder = placeholder.charAt(0).toUpperCase() + placeholder.slice(1);

        switch (dp.type) {
          case 'date':
            return (<Form.DatePicker key={key} id={id} title={title} />)
            break
          case 'checkbox':
            return (<Form.Checkbox key={key} id={id} title={title} label={placeholder} />)
            break
          case 'select':
           return (<Form.Dropdown key={key} id={id} title={title} >
                {dp.options?.map((opt) => {
                  return (<Form.Dropdown.Item  
                      key={'option::'+opt.id} 
                      value={opt.id} 
                      title={opt.name}
                      icon={(opt.color ? {source: Icon.Dot, tintColor: notionColorToTintColor(opt.color)} : undefined)}
                      />)
                })}
              </Form.Dropdown>
            )
            break
          case 'multi_select':
            return (<Form.TagPicker key={key} id={id} title={title} placeholder={placeholder}>
                {dp.options?.map((opt) => {
                  return (<Form.TagPicker.Item  
                      key={'option::'+opt.id} 
                      value={opt.id} 
                      title={opt.name}
                      icon={(opt.color ? {source: Icon.Dot, tintColor: notionColorToTintColor(opt.color)} : undefined)}/>)
                })}
              </Form.TagPicker>
            )            
            break
          default:
            return (<Form.TextField key={key} id={id} title={title} placeholder={placeholder} />)
        }
      })}
    </Form>
  )
}

export function NoSharedContent(): JSX.Element{
  return (<Detail markdown={`## No Shared Content 
  \n\n Make sure to **Invite** at least one database with the integration you have created.\n ![NotionShare](https://images.ctfassets.net/lzny33ho1g45/2pIkZOvLY2o2dwfnJIYJxt/d5d9f1318b2e79ad92d8197e4abab655/automate-notion-with-zapier-11-share-options.png)`} />)
}

function validateForm(values: FormValues): boolean {
  const valueKeys = Object.keys(values) as string[]
  const titleKey = valueKeys.filter(function (vk){ return vk.includes('property::title')})[0]
  if (!values[titleKey]) {
    showToast(ToastStyle.Failure, 'Please set title value');
    return false;
  }
  return true;
}


function notionColorToTintColor (notionColor: string): Color {
   const colorMapper = {
    'default': Color.PrimaryText,
    'gray': Color.PrimaryText,
    'brown': Color.Brown,
    'red': Color.Red,
    'blue': Color.Blue,
    'green': Color.Green,
    'yellow': Color.Yellow,
    'orange': Color.Orange,
    'purple': Color.Purple,
    'pink': Color.Magenta
  } as Record<string,Color>

  return colorMapper[notionColor] 
}

async function storeDatabases(database: Database[]) {
  const data = JSON.stringify(database)
  await setLocalStorageItem('DATABASES', data)
}

async function loadDatabases() {
  const data: string | undefined = await getLocalStorageItem('DATABASES')
  return data !== undefined ? JSON.parse(data) : undefined
}

async function storeDatabaseProperties(databaseId: string, databaseProperties: DatabasePropertie[]) {
  const data = JSON.stringify(databaseProperties)
  await setLocalStorageItem('DATABASE_PROPERTIES_'+databaseId, data)
}

async function loadDatabaseProperties(databaseId: string) {
  const data: string | undefined = await getLocalStorageItem('DATABASE_PROPERTIES_'+databaseId)
  return data !== undefined ? JSON.parse(data) : undefined
}
